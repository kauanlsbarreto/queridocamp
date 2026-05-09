import { createConnection, Connection } from "mysql2/promise";

export type DatabaseBinding = {
  connectionString?: string;
  host: string;
  user: string;
  password: string;
  database: string;
  port: number;
};

export type Env = {
  hostinger?: DatabaseBinding;
  DATABASE_URL?: string;
};

const DB_LOG_TIMEOUT_MS = Number(process.env.DB_QUERY_LOG_TIMEOUT_MS || 1200);
const DB_LOG_ENABLED = String(process.env.DB_QUERY_LOG_ENABLED || "0") === "1";

async function sendDiscordEmbed(payload: any) {
  if (!DB_LOG_ENABLED) return;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DB_LOG_TIMEOUT_MS);
  try {
    await fetch(
      "https://discord.com/api/webhooks/1481144167462867035/fGpYRcgSnBaoXKRWl3-0AWTheqtDg7FARCRXQwr4vrE40WDc1oZ8o2hDJ4ZVq9G6q4QY",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify(payload),
      }
    );
  } catch (e) {
    console.warn("failed to send discord embed", e);
  } finally {
    clearTimeout(timeout);
  }
}


function guessPageFromStack(): string {
  const stack = new Error().stack?.split("\n") || [];
  for (let i = 2; i < stack.length; i++) {
    const line = stack[i];
    const m = line.match(/\((.*?):\d+:\d+\)/);
    if (m && !m[1].includes("lib\\db.ts")) {
      const filePath = m[1];
      const appIndex = filePath.indexOf("app\\");
      if (appIndex !== -1) {
        let rel = filePath.slice(appIndex + 4); 
        rel = rel.replace(/\\/g, "/");
        rel = rel.replace(/\/page\.[tj]sx?$/, "");
        rel = rel.replace(/\/layout\.[tj]sx?$/, "");
        rel = rel.replace(/\/route\.[tj]sx?$/, "");
        if (rel === "") rel = "/";
        if (!rel.startsWith("/")) rel = "/" + rel;
        return rel;
      }
    }
  }
  return "<unknown>";
}

function wrapConnection(conn: Connection, dbLabel: string = "DATABASE"): Connection {
  let pageOverride: string | undefined;

  const handler: ProxyHandler<any> = {
    get(target, prop, receiver) {
      if (prop === "execute" || prop === "query") {
        return async (...args: any[]) => {
          const sql = args[0];
          const start = Date.now();
          try {
            return await target[prop](...args);
          } finally {
            const duration = Date.now() - start;
            const page = pageOverride ?? guessPageFromStack();
            const embed: any = {
              embeds: [
                {
                  title: "DB query",
                  color: 0x0000ff,
                  fields: [
                    { name: "page", value: page, inline: true },
                    {
                      name: "duration",
                      value: `${duration}ms`,
                      inline: true,
                    },
                    {
                      name: "sql",
                      value: typeof sql === "string" ? sql : "[parametrized]",
                    },
                  ],
                  timestamp: new Date().toISOString(),
                },
              ],
            };
            // Fire-and-forget to avoid blocking the request lifecycle.
            void sendDiscordEmbed(embed);
          }
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  };

  const proxy = new Proxy(conn, handler);
  (proxy as any).setPage = (p: string) => {
    pageOverride = p;
  };
  return proxy;
}

function isDatabaseBinding(value: unknown): value is DatabaseBinding {
  if (!value || typeof value !== "object") {
    return false;
  }

  const binding = value as Record<string, unknown>;
  return (
    typeof binding.host === "string" &&
    typeof binding.user === "string" &&
    typeof binding.password === "string" &&
    typeof binding.database === "string" &&
    typeof binding.port === "number"
  );
}

function parseDatabaseUrl(databaseUrl: string) {
  const parsedUrl = new URL(databaseUrl);
  const user = decodeURIComponent(parsedUrl.username);
  const password = decodeURIComponent(parsedUrl.password);
  const host = parsedUrl.hostname;
  const port = parseInt(parsedUrl.port || "3306", 10);
  const database = parsedUrl.pathname.replace(/^\//, "");

  if (!user || !host || !database) {
    throw new Error("DATABASE_URL está incompleta");
  }

  return {
    host,
    user,
    password,
    database,
    port,
  };
}

function getDatabaseBinding(env: Env): DatabaseBinding | null {
  // hostinger always takes priority
  if (isDatabaseBinding(env.hostinger)) {
    return env.hostinger;
  }

  return null;
}

export async function createDatabaseConnection(env: Env): Promise<Connection> {
  const databaseBinding = getDatabaseBinding(env);

  if (databaseBinding) {
    const conn = await createConnection({
      host: databaseBinding.host,
      user: databaseBinding.user,
      password: databaseBinding.password,
      database: databaseBinding.database,
      port: databaseBinding.port,
      disableEval: true,
    });

    return wrapConnection(conn, "DATABASE");
  }

  const dbUrl = process.env.DATABASE_URL || env.DATABASE_URL;

  if (!dbUrl) {
    throw new Error(
      "DATABASE_URL não foi definida. Use a variável de ambiente DATABASE_URL ou configure as variáveis individuais (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT)"
    );
  }

  try {
    const config = parseDatabaseUrl(dbUrl);
    const conn = await createConnection({
      ...config,
      disableEval: true,
    });

    return wrapConnection(conn, "DATABASE_URL");
  } catch (error) {
    if (error instanceof TypeError && (error as any).code === "ERR_INVALID_URL") {
      throw new Error(
        "DATABASE_URL inválida. Use o formato: mysql://user:password@host:port/database"
      );
    }
    throw error;
  }
}

export async function connectToDB(env: Env): Promise<Connection> {
  return createDatabaseConnection(env);
}

export async function createMainConnection(env: Env): Promise<Connection> {
  return createDatabaseConnection(env);
}

export async function createJogadoresConnection(env: Env): Promise<Connection> {
  return createDatabaseConnection(env);
}