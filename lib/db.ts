import { createConnection, Connection } from "mysql2/promise";

export type HyperdriveBinding = {
  host: string;
  user: string;
  password: string;
  database: string;
  port: number;
};

export type Env = {
  DB_PRINCIPAL?: HyperdriveBinding;
  DB_JOGADORES?: HyperdriveBinding;
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
      return m[1];
    }
  }
  return "<unknown>";
}

function wrapConnection(conn: Connection, dbLabel: string): Connection {
  const handler: ProxyHandler<any> = {
    get(target, prop, receiver) {
      if (prop === "execute" || prop === "query") {
        return async (...args: any[]) => {
          const sql = args[0];
          const start = Date.now();
          try {
            // @ts-ignore
            return await target[prop](...args);
          } finally {
            const duration = Date.now() - start;
            const page = guessPageFromStack();
            const isPrincipal = dbLabel === "DB_PRINCIPAL";
            const embed: any = {
              embeds: [
                {
                  title: "DB query",
                  color: isPrincipal ? 0x00ff00 : 0x0000ff,
                  fields: [
                    { name: "database", value: dbLabel, inline: true },
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
  return new Proxy(conn, handler);
}

export async function connectToDB(
  binding: HyperdriveBinding,
  label?: string
): Promise<Connection> {
  if (!binding) {
    throw new Error("Binding para conexão MySQL não foi definido");
  }

  const { host, user, password, database, port } = binding;

  const conn = await createConnection({
    host,
    user,
    password,
    database,
    port,
    disableEval: true,
  });

  return wrapConnection(conn, label || binding.database || "unknown");
}


export async function createMainConnection(env: Env): Promise<Connection> {
  if (!env.DB_PRINCIPAL) {
    throw new Error("Variável de ambiente DB_PRINCIPAL não configurada");
  }
  return connectToDB(env.DB_PRINCIPAL, "DB_PRINCIPAL");
}

export async function createJogadoresConnection(env: Env): Promise<Connection> {
  if (!env.DB_JOGADORES) {
    throw new Error("Variável de ambiente DB_JOGADORES não configurada");
  }
  return connectToDB(env.DB_JOGADORES, "DB_JOGADORES");
}
