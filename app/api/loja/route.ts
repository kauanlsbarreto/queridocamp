import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createMainConnection } from "@/lib/db";
import { LOJA_RELEASE_AT_ISO, LOJA_RELEASE_LABEL } from "@/lib/release-gates";

export const dynamic = "force-dynamic";

const LAUNCH_DATE = new Date(LOJA_RELEASE_AT_ISO).getTime();

type EstoqueRow = {
  id: number;
  nome: string;
  descricao: string | null;
  preco: number;
  moedas: number;
  estoque: number;
  imagem_url: string | null;
  categoria: string | null;
  data_adicionado: string;
  ativo: number;
  tipo_item: string | null;
};

type StorePayload = {
  nome: string;
  descricao: string | null;
  preco: number;
  moedas: number;
  estoque: number;
  imagem_url: string | null;
  categoria: string | null;
  tipo_item: string | null;
  ativo: number;
};

function normalizeImageUrl(raw: string) {
  const value = raw.trim().replace(/\\/g, "/");
  if (!value) return null;

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  let localPath = value;
  if (localPath.toLowerCase().startsWith("public/")) {
    localPath = localPath.slice("public".length);
  }

  if (!localPath.startsWith("/")) {
    localPath = `/${localPath}`;
  }

  return localPath;
}

function parseStorePayload(body: Record<string, unknown>) {
  const {
    nome,
    descricao,
    preco,
    moedas,
    estoque,
    imagem_url,
    categoria,
    tipo_item,
    ativo,
    modo_pagamento,
  } = body;

  const itemName = String(nome || "").trim();
  if (!itemName) {
    return { error: "Nome do item é obrigatório." } as const;
  }

  const paymentMode = String(modo_pagamento || "preco").toLowerCase();
  const itemPreco = Number(preco || 0);
  const itemMoedas = Number(moedas || 0);
  const itemEstoque = Number(estoque || 0);

  if (!Number.isFinite(itemEstoque) || itemEstoque < 0) {
    return { error: "Estoque inválido." } as const;
  }

  if (paymentMode === "preco") {
    if (!Number.isFinite(itemPreco) || itemPreco <= 0) {
      return { error: "Preço em reais inválido." } as const;
    }
  } else if (paymentMode === "moedas") {
    if (!Number.isFinite(itemMoedas) || itemMoedas <= 0) {
      return { error: "Valor em moedas inválido." } as const;
    }
  } else {
    return { error: "Modo de pagamento inválido." } as const;
  }

  const payload: StorePayload = {
    nome: itemName,
    descricao: String(descricao || "").trim() || null,
    preco: paymentMode === "preco" ? itemPreco : 0,
    moedas: paymentMode === "moedas" ? Math.floor(itemMoedas) : 0,
    estoque: Math.floor(itemEstoque),
    imagem_url: normalizeImageUrl(String(imagem_url || "")),
    categoria: String(categoria || "").trim() || null,
    tipo_item: String(tipo_item || "").trim() || null,
    ativo: ativo === false ? 0 : 1,
  };

  return { payload } as const;
}

async function ensureTable(connection: any) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS estoque (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nome VARCHAR(255) NOT NULL,
      descricao TEXT,
      preco DECIMAL(10, 2) NOT NULL,
      moedas INT DEFAULT 0,
      estoque INT DEFAULT 0,
      imagem_url VARCHAR(255),
      categoria VARCHAR(100),
      data_adicionado TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ativo BOOLEAN DEFAULT TRUE,
      tipo_item VARCHAR(100),
      CONSTRAINT estoque_positivo CHECK (estoque >= 0)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

async function isAdminOneOrTwo(connection: any, faceitGuid: string) {
  const [rows] = await connection.query("SELECT admin FROM players WHERE faceit_guid = ? LIMIT 1", [faceitGuid]);
  const adminRows = rows as Array<{ admin: number | null }>;
  if (!adminRows.length) return false;
  return adminRows[0].admin === 1 || adminRows[0].admin === 2;
}

export async function GET(request: Request) {
  let connection: any;
  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as any;
    connection = await createMainConnection(env);

    await ensureTable(connection);

    const now = Date.now();
    const isPreLaunch = now < LAUNCH_DATE;

    if (isPreLaunch) {
      const faceitGuid = (request.headers.get("x-faceit-guid") || "").trim();
      if (!faceitGuid) {
        return NextResponse.json(
          { message: `A loja abre em ${LOJA_RELEASE_LABEL}. Somente Admin 1 e 2 podem visualizar antes dessa data.` },
          { status: 403 },
        );
      }

      const allowed = await isAdminOneOrTwo(connection, faceitGuid);
      if (!allowed) {
        return NextResponse.json(
          { message: `A loja abre em ${LOJA_RELEASE_LABEL}. Somente Admin 1 e 2 podem visualizar antes dessa data.` },
          { status: 403 },
        );
      }
    }

    const [rows] = await connection.query(
      `SELECT id, nome, descricao, preco, moedas, estoque, imagem_url, categoria, data_adicionado, ativo, tipo_item
       FROM estoque
       WHERE ativo = 1
       ORDER BY data_adicionado DESC`,
    );

    return NextResponse.json({ items: rows as EstoqueRow[] }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ message }, { status: 500 });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

export async function POST(request: Request) {
  let connection: any;
  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as any;
    connection = await createMainConnection(env);

    await ensureTable(connection);

    const body = await request.json().catch(() => ({}));
    const { faceit_guid } = body as Record<string, unknown>;

    const guid = String(faceit_guid || "").trim();
    if (!guid) {
      return NextResponse.json({ message: "faceit_guid ausente." }, { status: 400 });
    }

    const allowed = await isAdminOneOrTwo(connection, guid);
    if (!allowed) {
      return NextResponse.json({ message: "Apenas Admin 1 e 2 podem adicionar itens." }, { status: 403 });
    }

    const parsed = parseStorePayload(body as Record<string, unknown>);
    if ("error" in parsed) {
      return NextResponse.json({ message: parsed.error }, { status: 400 });
    }

    const { payload } = parsed;

    await connection.query(
      `INSERT INTO estoque (nome, descricao, preco, moedas, estoque, imagem_url, categoria, ativo, tipo_item)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.nome,
        payload.descricao,
        payload.preco,
        payload.moedas,
        payload.estoque,
        payload.imagem_url,
        payload.categoria,
        payload.ativo,
        payload.tipo_item,
      ],
    );

    return NextResponse.json({ success: true, message: "Item adicionado com sucesso." }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ message }, { status: 500 });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

export async function PUT(request: Request) {
  let connection: any;
  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as any;
    connection = await createMainConnection(env);

    await ensureTable(connection);

    const body = await request.json().catch(() => ({}));
    const { faceit_guid, id } = body as Record<string, unknown>;

    const guid = String(faceit_guid || "").trim();
    if (!guid) {
      return NextResponse.json({ message: "faceit_guid ausente." }, { status: 400 });
    }

    const itemId = Number(id || 0);
    if (!Number.isFinite(itemId) || itemId <= 0) {
      return NextResponse.json({ message: "ID do item inválido." }, { status: 400 });
    }

    const allowed = await isAdminOneOrTwo(connection, guid);
    if (!allowed) {
      return NextResponse.json({ message: "Apenas Admin 1 e 2 podem editar itens." }, { status: 403 });
    }

    const parsed = parseStorePayload(body as Record<string, unknown>);
    if ("error" in parsed) {
      return NextResponse.json({ message: parsed.error }, { status: 400 });
    }

    const { payload } = parsed;

    await connection.query(
      `UPDATE estoque
       SET nome = ?, descricao = ?, preco = ?, moedas = ?, estoque = ?, imagem_url = ?, categoria = ?, ativo = ?, tipo_item = ?
       WHERE id = ?`,
      [
        payload.nome,
        payload.descricao,
        payload.preco,
        payload.moedas,
        payload.estoque,
        payload.imagem_url,
        payload.categoria,
        payload.ativo,
        payload.tipo_item,
        itemId,
      ],
    );

    return NextResponse.json({ success: true, message: "Item atualizado com sucesso." }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ message }, { status: 500 });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}
