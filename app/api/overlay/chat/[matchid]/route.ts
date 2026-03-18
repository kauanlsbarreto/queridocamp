import { NextResponse } from "next/server";

interface FaceitMatchResponse {
  match_id: string;
  chat_room_id?: string;
  teams?: {
    faction1?: {
      roster?: Array<{ player_id?: string; nickname?: string }>;
    };
    faction2?: {
      roster?: Array<{ player_id?: string; nickname?: string }>;
    };
  };
}

interface NormalizedChatMessage {
  id: string;
  body: string;
  nickname: string;
  createdAt: string;
}

function toIsoDate(value: unknown): string {
  if (typeof value === "number") {
    const ms = value > 1e12 ? value : value * 1000;
    return new Date(ms).toISOString();
  }

  if (typeof value === "string") {
    const asNumber = Number(value);
    if (!Number.isNaN(asNumber) && value.trim() !== "") {
      const ms = asNumber > 1e12 ? asNumber : asNumber * 1000;
      return new Date(ms).toISOString();
    }

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }

  return new Date(0).toISOString();
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ matchid: string }> }
) {
  try {
    const { matchid } = await params;

    if (!matchid) {
      return NextResponse.json({ error: "matchid ausente" }, { status: 400 });
    }

    const apiKey = process.env.FACEIT_API_KEY || "7b080715-fe0b-461d-a1f1-62cfd0c47e63";
    const dataHeaders = { Authorization: `Bearer ${apiKey}` };
    const authHeader = request.headers.get("authorization") || "";
    const userToken = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : "";

    const matchResponse = await fetch(`https://open.faceit.com/data/v4/matches/${matchid}`, {
      headers: dataHeaders,
      cache: "no-store",
    });

    if (!matchResponse.ok) {
      return NextResponse.json(
        { error: "nao foi possivel buscar dados da partida" },
        { status: matchResponse.status }
      );
    }

    const matchData = (await matchResponse.json()) as FaceitMatchResponse;
    const roomId = matchData.chat_room_id;

    if (!roomId) {
      return NextResponse.json({ messages: [], roomId: null });
    }

    const playerIds = new Set<string>();
    const playerNicknames = new Set<string>();

    const roster = [
      ...(matchData.teams?.faction1?.roster || []),
      ...(matchData.teams?.faction2?.roster || []),
    ];

    for (const player of roster) {
      if (player.player_id) playerIds.add(player.player_id);
      if (player.nickname) playerNicknames.add(player.nickname.trim().toLowerCase());
    }

    const chatHeaders = userToken
      ? { Authorization: `Bearer ${userToken}` }
      : dataHeaders;

    const roomCandidates = [
      roomId,
      roomId.endsWith("-general") ? roomId : `${roomId}-general`,
      roomId.endsWith("-all") ? roomId : `${roomId}-all`,
    ];

    let chatResponse: Response | null = null;
    let resolvedRoomId = roomId;
    let lastStatus = 0;

    for (const candidate of roomCandidates) {
      const response = await fetch(
        `https://open.faceit.com/chat/v1/rooms/${encodeURIComponent(candidate)}/messages?limit=50`,
        {
          headers: chatHeaders,
          cache: "no-store",
        }
      );

      if (response.ok) {
        chatResponse = response;
        resolvedRoomId = candidate;
        break;
      }

      lastStatus = response.status;
    }

    if (!chatResponse) {
      const needsOauthToken = !userToken || lastStatus === 401 || lastStatus === 403;
      const diagnostic = needsOauthToken
        ? "Chat API requer OAuth token do usuario (faceit_user.accessToken)."
        : "Room nao encontrado ou sem acesso ao chat dessa partida.";

      return NextResponse.json(
        {
          messages: [],
          roomId: resolvedRoomId,
          error: `nao foi possivel buscar mensagens do chat (${diagnostic})`,
        },
        { status: 200 }
      );
    }

    const chatPayload = await chatResponse.json();
    const rawMessages = Array.isArray(chatPayload?.messages) ? chatPayload.messages : [];

    const normalizedMessages: NormalizedChatMessage[] = rawMessages
      .map((msg: any, index: number) => {
        const type = String(msg?.type || "").toLowerCase();
        const authorId =
          msg?.user_id || msg?.author_id || msg?.sender_id || msg?.author?.id || msg?.user?.id || null;
        const nickname =
          msg?.nickname ||
          msg?.author_nickname ||
          msg?.author?.nickname ||
          msg?.user?.nickname ||
          "";
        const body = String(msg?.body || msg?.message || msg?.content || "").trim();

        const isPlayerById = authorId ? playerIds.has(String(authorId)) : false;
        const isPlayerByNickname = nickname
          ? playerNicknames.has(String(nickname).trim().toLowerCase())
          : false;
        const seemsSystem = type.includes("system") || type.includes("notification");

        if (!body || seemsSystem || (!isPlayerById && !isPlayerByNickname)) {
          return null;
        }

        const createdAt = toIsoDate(
          msg?.created_at || msg?.createdAt || msg?.timestamp || msg?.sent_at || msg?.time
        );

        return {
          id: String(msg?.id || msg?._id || `${createdAt}-${index}`),
          body,
          nickname: String(nickname || "PLAYER"),
          createdAt,
        };
      })
      .filter(Boolean)
      .sort((a: NormalizedChatMessage, b: NormalizedChatMessage) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(-12) as NormalizedChatMessage[];

    return NextResponse.json({
      roomId: resolvedRoomId,
      messages: normalizedMessages,
    });
  } catch (error) {
    console.error("Erro no overlay de chat:", error);
    return NextResponse.json({ error: "erro interno" }, { status: 500 });
  }
}
