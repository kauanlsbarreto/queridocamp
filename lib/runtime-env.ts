import type { Env } from "@/lib/db";

function parsePort(raw: string | undefined, fallback: number) {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function resolveFromDatabaseUrl(databaseUrl: string): Env["hostinger"] | undefined {
  try {
    const url = new URL(databaseUrl);
    const host = url.hostname;
    const user = decodeURIComponent(url.username || "");
    const password = decodeURIComponent(url.password || "");
    const database = url.pathname.replace(/^\//, "");
    const port = parsePort(url.port, 3306);

    if (!host || !user || !database) return undefined;

    return {
      connectionString: databaseUrl,
      host,
      user,
      password,
      database,
      port,
    };
  } catch {
    return undefined;
  }
}

function resolveFromProcessEnv(): Env {
  const dbHost = String(process.env.DB_HOST || "").trim();
  const dbUser = String(process.env.DB_USER || "").trim();
  const dbPassword = String(process.env.DB_PASSWORD || "");
  const dbName = String(process.env.DB_NAME || "").trim();
  const dbPort = parsePort(process.env.DB_PORT, 3306);

  const databaseUrl = String(process.env.DATABASE_URL || "").trim();

  const hostingerFromUrl = resolveFromDatabaseUrl(databaseUrl);

  if (hostingerFromUrl) {
    return {
      hostinger: hostingerFromUrl,
      DATABASE_URL: databaseUrl || undefined,
    };
  }

  if (dbHost && dbUser && dbName) {
    return {
      hostinger: {
        connectionString: databaseUrl || undefined,
        host: dbHost,
        user: dbUser,
        password: dbPassword,
        database: dbName,
        port: dbPort,
      },
      DATABASE_URL: databaseUrl || undefined,
    };
  }

  return {
    DATABASE_URL: databaseUrl || undefined,
  };
}

export async function getRuntimeEnv(): Promise<Env> {
  // Always use process environment (Node.js/Docker mode)
  return resolveFromProcessEnv();
}
