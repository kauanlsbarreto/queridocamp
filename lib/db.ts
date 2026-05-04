import { createConnection, Connection } from "mysql2/promise";

export type HyperdriveBinding = {
  connectionString?: string;
  host: string;
  user: string;
  password: string;
  database: string;
  port: number;
};

export type Env = {
  hostinger?: HyperdriveBinding;
  DB_PRINCIPAL?: HyperdriveBinding;
  DB_JOGADORES?: HyperdriveBinding;
  DATABASE_URL?: string;
};

async function sendDiscordEmbed(payload: any) {
  try {
    await fetch(
      "https://discord.com/api/webhooks/1481144167462867035/fGpYRcgSnBaoXKRWl3-0AWTheqtDg7FARCRXQwr4vrE40WDc1oZ8o2hDJ4ZVq9G6q4QY",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
  } catch (e) {
    console.warn("failed to send discord embed", e);
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
            sendDiscordEmbed(embed);
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

function isHyperdriveBinding(value: unknown): value is HyperdriveBinding {
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

function getDatabaseBinding(env: Env, label?: "DB_PRINCIPAL" | "DB_JOGADORES") {
  if (isHyperdriveBinding(env.hostinger)) {
    return {
      binding: env.hostinger,
      label: "hostinger",
    };
  }

  if (label === "DB_JOGADORES" && isHyperdriveBinding(env.DB_JOGADORES)) {
    return {
      binding: env.DB_JOGADORES,
      label: "DB_JOGADORES",
    };
  }

  if (label === "DB_PRINCIPAL" && isHyperdriveBinding(env.DB_PRINCIPAL)) {
    return {
      binding: env.DB_PRINCIPAL,
      label: "DB_PRINCIPAL",
    };
  }

  if (isHyperdriveBinding(env.DB_PRINCIPAL)) {
    return {
      binding: env.DB_PRINCIPAL,
      label: "DB_PRINCIPAL",
    };
  }

  if (isHyperdriveBinding(env.DB_JOGADORES)) {
    return {
      binding: env.DB_JOGADORES,
      label: "DB_JOGADORES",
    };
  }

  return null;
}

export async function createDatabaseConnection(
  env: Env,
  label?: "DB_PRINCIPAL" | "DB_JOGADORES"
): Promise<Connection> {
  const hyperdriveConfig = getDatabaseBinding(env, label);

  if (hyperdriveConfig) {
    const conn = await createConnection({
      host: hyperdriveConfig.binding.host,
      user: hyperdriveConfig.binding.user,
      password: hyperdriveConfig.binding.password,
      database: hyperdriveConfig.binding.database,
      port: hyperdriveConfig.binding.port,
      disableEval: true,
    });

    return wrapConnection(conn, hyperdriveConfig.label);
  }

  const dbUrl = process.env.DATABASE_URL || env.DATABASE_URL;

  if (!dbUrl) {
    throw new Error("Nenhuma binding Hyperdrive ou DATABASE_URL foi definida");
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
      throw new Error("DATABASE_URL format inválido. Use: mysql://user:password@host:port/database");
    }
    throw error;
  }
}

export async function connectToDB(env: Env): Promise<Connection> {
  return createDatabaseConnection(env);
}

export async function createMainConnection(env: Env): Promise<Connection> {
  return createDatabaseConnection(env, "DB_PRINCIPAL");
}

export async function createJogadoresConnection(env: Env): Promise<Connection> {
  return createDatabaseConnection(env, "DB_JOGADORES");
}
