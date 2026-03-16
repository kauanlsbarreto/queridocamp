import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createMainConnection, type Env } from "@/lib/db";
import type { RowDataPacket } from "mysql2";
import type { Connection } from "mysql2/promise";

export const dynamic = "force-dynamic";

type ServiceState = "operational" | "degraded" | "down";

type ServiceCheck = {
  id: string;
  name: string;
  status: ServiceState;
  httpStatus: number | null;
  latencyMs: number | null;
  message: string;
  checkedAt: string;
  pages: string[];
};

type ErrorRow = {
  source: "service" | "login";
  service: string;
  page: string;
  error: string;
  timestamp: string;
};

type LoginErrorRow = RowDataPacket & {
  horario: string;
  nickname: string;
  error_message: string | null;
};

type PersistedStatusErrorRow = RowDataPacket & {
  source: "service";
  service: string;
  page: string;
  error_message: string;
  created_at: string;
};

type StatusSnapshotRow = RowDataPacket & {
  payload: string;
  updated_at: string;
};

async function fetchWithTimeout(url: string, timeoutMs: number, init?: RequestInit) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function checkHttpService(params: {
  id: string;
  name: string;
  url: string;
  pages: string[];
  timeoutMs?: number;
  init?: RequestInit;
}): Promise<ServiceCheck> {
  const startedAt = Date.now();
  try {
    const response = await fetchWithTimeout(params.url, params.timeoutMs ?? 8000, params.init);
    const latencyMs = Date.now() - startedAt;
    const isOperational = response.status >= 200 && response.status < 400;

    return {
      id: params.id,
      name: params.name,
      status: isOperational ? "operational" : "down",
      httpStatus: response.status,
      latencyMs,
      message: isOperational
        ? "Serviço respondeu normalmente."
        : `Serviço respondeu com status ${response.status}.`,
      checkedAt: new Date().toISOString(),
      pages: params.pages,
    };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";

    return {
      id: params.id,
      name: params.name,
      status: "down",
      httpStatus: null,
      latencyMs,
      message: `Falha de conexão: ${errorMessage}`,
      checkedAt: new Date().toISOString(),
      pages: params.pages,
    };
  }
}

export async function GET(request: Request) {
  let connection: Connection | null = null;
  try {
    const { searchParams, origin } = new URL(request.url);
    const faceitGuid = searchParams.get("faceit_guid");
    const shouldRefresh = searchParams.get("refresh") === "1";

    if (!faceitGuid) {
      return NextResponse.json({ error: "Faceit GUID obrigatório." }, { status: 401 });
    }

    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as unknown as Env;
    connection = await createMainConnection(env);

    const [adminRows] = await connection.query<RowDataPacket[]>(
      "SELECT admin FROM players WHERE faceit_guid = ? LIMIT 1",
      [faceitGuid]
    );

    const adminLevel = Number(adminRows?.[0]?.admin ?? 0);
    if (adminLevel !== 1 && adminLevel !== 2) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const checks: ServiceCheck[] = [];

    await connection.query(`
      CREATE TABLE IF NOT EXISTS status_snapshot (
        id INT PRIMARY KEY,
        payload LONGTEXT NOT NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    if (!shouldRefresh) {
      const [snapshotRows] = await connection.query<StatusSnapshotRow[]>(
        "SELECT payload, updated_at FROM status_snapshot WHERE id = 1 LIMIT 1"
      );

      if (snapshotRows.length > 0) {
        try {
          const parsed = JSON.parse(snapshotRows[0].payload);
          return NextResponse.json({
            ...parsed,
            cached: true,
            snapshotUpdatedAt: new Date(snapshotRows[0].updated_at).toISOString(),
          });
        } catch {
          // Se o cache estiver corrompido, segue para refresh e regrava snapshot.
        }
      }
    }

    await connection.query(`
      CREATE TABLE IF NOT EXISTS status_errors (
        id INT AUTO_INCREMENT PRIMARY KEY,
        source VARCHAR(20) NOT NULL DEFAULT 'service',
        service VARCHAR(150) NOT NULL,
        page TEXT NOT NULL,
        error_message TEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Mantem o histórico enxuto e garante expiração de 7 dias.
    await connection.query("DELETE FROM status_errors WHERE created_at < (NOW() - INTERVAL 7 DAY)");

    const railwayBotUrl =
      process.env.RAILWAY_BOT_URL ||
      "https://bot-queridocamp-production.up.railway.app";

    const cloudflareZoneId =
      process.env.CLOUDFLARE_ZONE_ID || "4cefcb0f820487b4ada15baf5df3aaf2";
    const cloudflareAccountId =
      process.env.CLOUDFLARE_ACCOUNT_ID || "91a0b67f7e786b87635e5ca33efa0db3";
    const cloudflareApiToken = process.env.CLOUDFLARE_API_TOKEN;

    const siteUrl = process.env.SITE_URL || origin;

    const faceitApiKey = process.env.FACEIT_API_KEY || "7b080715-fe0b-461d-a1f1-62cfd0c47e63";
    checks.push(
      await checkHttpService({
        id: "faceit",
        name: "API Faceit",
        url: "https://open.faceit.com/data/v4/games?offset=0&limit=1",
        pages: ["/players", "/stats", "/partidas", "/adminstracao"],
        init: {
          method: "GET",
          headers: {
            Authorization: `Bearer ${faceitApiKey}`,
          },
        },
      })
    );

    const dbStarted = Date.now();
    let railwayDbCheck: ServiceCheck;
    try {
      await connection.query("SELECT 1 AS ok");
      railwayDbCheck = {
        id: "railway-db",
        name: "Railway (Banco de Dados)",
        status: "operational",
        httpStatus: 200,
        latencyMs: Date.now() - dbStarted,
        message: "Conexão com banco ativa.",
        checkedAt: new Date().toISOString(),
        pages: [
          "/classificacao",
          "/times",
          "/players",
          "/partidas",
          "/status",
          "/api/*",
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      railwayDbCheck = {
        id: "railway-db",
        name: "Railway (Banco de Dados)",
        status: "down",
        httpStatus: null,
        latencyMs: Date.now() - dbStarted,
        message: `Falha no banco: ${errorMessage}`,
        checkedAt: new Date().toISOString(),
        pages: [
          "/classificacao",
          "/times",
          "/players",
          "/partidas",
          "/status",
          "/api/*",
        ],
      };
    }
    checks.push(railwayDbCheck);

    checks.push(
      await checkHttpService({
        id: "railway-bot",
        name: "Railway (Bot)",
        url: railwayBotUrl,
        pages: ["/servidor", "/status"],
        init: {
          method: "GET",
        },
      })
    );

    checks.push(
      await checkHttpService({
        id: "github",
        name: "GitHub API",
        url: "https://api.github.com/rate_limit",
        pages: ["/agendarjogo", "/inscricao", "/api/logins"],
        init: {
          method: "GET",
          headers: {
            "User-Agent": "queridocamp-status-check",
            Accept: "application/vnd.github+json",
          },
        },
      })
    );

    checks.push(
      await checkHttpService({
        id: "cloudflare",
        name: "Site Cloudflare",
        url: `${siteUrl}/`,
        pages: ["/"],
        init: {
          method: "GET",
        },
      })
    );

    if (cloudflareApiToken) {
      checks.push(
        await checkHttpService({
          id: "cloudflare-api",
          name: "Cloudflare API",
          url: `https://api.cloudflare.com/client/v4/zones/${cloudflareZoneId}`,
          pages: ["/status", "/api/*"],
          init: {
            method: "GET",
            headers: {
              Authorization: `Bearer ${cloudflareApiToken}`,
              "Content-Type": "application/json",
            },
          },
        })
      );
    } else {
      checks.push({
        id: "cloudflare-api",
        name: "Cloudflare API",
        status: "degraded",
        httpStatus: null,
        latencyMs: null,
        message: `Token ausente (CLOUDFLARE_API_TOKEN). Zone: ${cloudflareZoneId}, Account: ${cloudflareAccountId}`,
        checkedAt: new Date().toISOString(),
        pages: ["/status", "/api/*"],
      });
    }

    const serviceErrors: ErrorRow[] = checks
      .filter((service) => service.status !== "operational")
      .map((service) => ({
        source: "service",
        service: service.name,
        page: service.pages.join(", "),
        error: service.message,
        timestamp: service.checkedAt,
      }));

    if (serviceErrors.length > 0) {
      for (const err of serviceErrors) {
        const [duplicateRows] = await connection.query<RowDataPacket[]>(
          `SELECT id
             FROM status_errors
            WHERE source = ?
              AND service = ?
              AND page = ?
              AND error_message = ?
              AND created_at >= (NOW() - INTERVAL 5 MINUTE)
            LIMIT 1`,
          [err.source, err.service, err.page, err.error]
        );

        if (!duplicateRows.length) {
          await connection.query(
            "INSERT INTO status_errors (source, service, page, error_message) VALUES (?, ?, ?, ?)",
            [err.source, err.service, err.page, err.error]
          );
        }
      }
    }

    const [persistedServiceErrorsRows] = await connection.query<PersistedStatusErrorRow[]>(
      `SELECT source, service, page, error_message, created_at
         FROM status_errors
        WHERE created_at >= (NOW() - INTERVAL 7 DAY)
        ORDER BY created_at DESC
        LIMIT 200`
    );

    const persistedServiceErrors: ErrorRow[] = persistedServiceErrorsRows.map((row) => ({
      source: "service",
      service: row.service,
      page: row.page,
      error: row.error_message,
      timestamp: new Date(row.created_at).toISOString(),
    }));

    let loginErrors: ErrorRow[] = [];
    try {
      const [logRows] = await connection.query<LoginErrorRow[]>(
        "SELECT horario, nickname, error_message FROM logs_logins WHERE success = 0 AND horario >= (NOW() - INTERVAL 7 DAY) ORDER BY horario DESC LIMIT 200"
      );

      loginErrors = logRows.map((row) => ({
        source: "login",
        service: "Login Faceit",
        page: "/login",
        error:
          row.error_message?.trim() ||
          `Falha de login para ${row.nickname || "usuário desconhecido"}`,
        timestamp: row.horario ? new Date(row.horario).toISOString() : new Date().toISOString(),
      }));
    } catch {
      loginErrors = [];
    }

    const errors = [...persistedServiceErrors, ...loginErrors].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    const operationalCount = checks.filter((service) => service.status === "operational").length;
    const availability = Number(((operationalCount / checks.length) * 100).toFixed(2));

    const payload = {
      allOperational: availability === 100,
      availability,
      checkedAt: new Date().toISOString(),
      services: checks,
      errors,
      cached: false,
    };

    await connection.query(
      `INSERT INTO status_snapshot (id, payload)
       VALUES (1, ?)
       ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = CURRENT_TIMESTAMP`,
      [JSON.stringify(payload)]
    );

    return NextResponse.json(payload);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json(
      {
        error: "Falha ao montar status",
        details: errorMessage,
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}
