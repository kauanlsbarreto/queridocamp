"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Copy, ExternalLink, Loader, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import Image from "next/image"

interface MatchDetails {
    match_id: string;
    status: string;
    game: string;
    teams: { 
        faction1: { name: string; avatar: string }; 
        faction2: { name: string; avatar: string } 
    };
    results?: {
        score: { faction1: number; faction2: number };
    };
}

const API_KEY_FACEIT = "7b080715-fe0b-461d-a1f1-62cfd0c47e63";
const HUB_IDS = [
    "fdd5221c-408c-4148-bc63-e2940da4a490",
    "04a14d7f-0511-451b-8208-9a6c3215ccaa"
];

export default function PlaycarPage() {
    const [matches, setMatches] = useState<MatchDetails[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [userAdminLevel, setUserAdminLevel] = useState(0);
    const router = useRouter();

    useEffect(() => {
        const checkAccess = async () => {
            if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
                const storedUser = localStorage.getItem("faceit_user");
                if (storedUser) {
                    try {
                        const user = JSON.parse(storedUser);
                        const adminLevel = user.Admin || user.admin || 0;
                        
                        if (adminLevel === 1 || adminLevel === 2 || adminLevel === 5) {
                            setUserAdminLevel(adminLevel);
                            setIsAuthorized(true);
                            fetchMatches();
                            return;
                        }
                    } catch (e) {
                        console.error("Erro ao parsear usuário", e);
                    }
                }
                router.push("/");
                return;
            }

            const storedUser = localStorage.getItem("faceit_user");
            if (storedUser) {
                try {
                    const user = JSON.parse(storedUser);
                    const faceitGuid = user.faceit_guid;
                    
                    const res = await fetch(`/api/admin/players?faceit_guid=${faceitGuid}`);
                    const data = await res.json();
                    
                    const adminLevel = data.admin || 0;
                    
                    if (adminLevel === 1 || adminLevel === 2 || adminLevel === 5) {
                        setUserAdminLevel(adminLevel);
                        setIsAuthorized(true);
                        fetchMatches();
                    } else {
                        router.push("/");
                    }
                } catch (e) {
                    console.error("Erro ao verificar acesso:", e);
                    router.push("/");
                }
            } else {
                router.push("/");
            }
        };

        checkAccess();
    }, [router]);

    const fetchMatches = useCallback(async () => {
        setLoading(true);
        try {
            const hubPromises = HUB_IDS.map(hubId => 
                fetch(`https://open.faceit.com/data/v4/hubs/${hubId}/matches?type=ongoing&limit=15`, {
                    headers: { 'Authorization': `Bearer ${API_KEY_FACEIT}` }
                }).then(res => res.json())
            );

            const hubResults = await Promise.all(hubPromises);
            const allOngoingItems = hubResults.flatMap(data => data.items || []);

            if (allOngoingItems.length > 0) {
                const detailPromises = allOngoingItems.map((m: any) =>
                    fetch(`https://open.faceit.com/data/v4/matches/${m.match_id}`, {
                        headers: { 'Authorization': `Bearer ${API_KEY_FACEIT}` }
                    }).then(r => r.json())
                );
                
                const details = await Promise.all(detailPromises);
                const activeMatches = details.filter(match => 
                    match && (match.status === 'ONGOING' || match.status === 'READY')
                );
                setMatches(activeMatches);
            } else {
                setMatches([]);
            }
        } catch (e) {
            console.error("Erro ao buscar partidas:", e);
            setMatches([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const copyToClipboard = (matchId: string, overlayType: "placar" | "chat" = "placar") => {
        const overlayUrl = `${window.location.origin}/overlay/${overlayType}/${matchId}`;
        navigator.clipboard.writeText(overlayUrl);
        setCopiedId(`${overlayType}-${matchId}`);
        setTimeout(() => setCopiedId(null), 2000);
    };

    if (!isAuthorized) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <Loader className="animate-spin text-gold" size={32} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black p-6">
            <div className="max-w-6xl mx-auto">
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <h1 className="text-4xl font-bold text-gold uppercase tracking-tighter mb-2">
                            Overlays de Partidas
                        </h1>
                        <p className="text-gray-400">Links para OBS - Copie a URL e adicione como Source</p>
                    </div>
                    <a
                        href="/overlay/placar/test"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex"
                    >
                        <Button
                            variant="outline"
                            className="border-gold/50 text-gold hover:bg-gold/10"
                        >
                            🧪 Teste
                        </Button>
                    </a>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader className="animate-spin text-gold" size={32} />
                    </div>
                ) : matches.length === 0 ? (
                    <Card className="bg-gray-900 border-gray-800 p-8 text-center">
                        <p className="text-gray-400">Nenhuma partida ao vivo no momento</p>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {matches.map((match) => (
                            <Card key={match.match_id} className="bg-gray-900 border-gray-800 overflow-hidden hover:border-gold/50 transition-colors">
                                <div className="p-6">
                                    <div className="flex items-center justify-between gap-6">
                                        <div className="flex items-center gap-4 flex-1 min-w-0">
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <div className="w-12 h-12 relative rounded-full overflow-hidden flex-shrink-0 border border-gray-700">
                                                    <Image 
                                                        src={match.teams.faction1.avatar || "https://cdn.faceit.com/static/stats/avatar/default_user_blue.png"} 
                                                        alt={match.teams.faction1.name}
                                                        fill
                                                        className="object-cover"
                                                    />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-sm font-bold text-white uppercase line-clamp-1">
                                                        {match.teams.faction1.name}
                                                    </div>
                                                    <div className="text-xs text-gray-500">Faction 1</div>
                                                </div>
                                            </div>

                                            <div className="text-center flex-shrink-0">
                                                <div className="text-xl font-black text-gold">VS</div>
                                            </div>

                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <div className="w-12 h-12 relative rounded-full overflow-hidden flex-shrink-0 border border-gray-700">
                                                    <Image 
                                                        src={match.teams.faction2.avatar || "https://cdn.faceit.com/static/stats/avatar/default_user_blue.png"} 
                                                        alt={match.teams.faction2.name}
                                                        fill
                                                        className="object-cover"
                                                    />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-sm font-bold text-white uppercase line-clamp-1">
                                                        {match.teams.faction2.name}
                                                    </div>
                                                    <div className="text-xs text-gray-500">Faction 2</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 flex-shrink-0">
                                            <div className="text-right">
                                                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase ${
                                                    match.status === 'READY' ? 'bg-blue-900/50 text-blue-300' : 'bg-red-900/50 text-red-300'
                                                }`}>
                                                    <div className={`w-2 h-2 rounded-full ${
                                                        match.status === 'READY' ? 'bg-blue-500' : 'bg-red-600 animate-pulse'
                                                    }`}></div>
                                                    {match.status === 'READY' ? 'Pronto' : 'Ao Vivo'}
                                                </div>
                                            </div>

                                            <Button
                                                onClick={() => copyToClipboard(match.match_id, "placar")}
                                                variant="outline"
                                                size="sm"
                                                className={`border-gold/50 text-gold hover:bg-gold/10 ${
                                                    copiedId === `placar-${match.match_id}` ? 'bg-gold/20' : ''
                                                }`}
                                            >
                                                <Copy size={16} />
                                                {copiedId === `placar-${match.match_id}` ? 'Copiado!' : 'Copiar Placar'}
                                            </Button>

                                            <a
                                                href={`/overlay/placar/${match.match_id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex"
                                            >
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="border-gold/50 text-gold hover:bg-gold/10"
                                                >
                                                    <ExternalLink size={16} />
                                                    Abrir
                                                </Button>
                                            </a>

                                            <Button
                                                onClick={() => copyToClipboard(match.match_id, "chat")}
                                                variant="outline"
                                                size="sm"
                                                className={`border-gold/50 text-gold hover:bg-gold/10 ${
                                                    copiedId === `chat-${match.match_id}` ? 'bg-gold/20' : ''
                                                }`}
                                            >
                                                <MessageSquare size={16} />
                                                {copiedId === `chat-${match.match_id}` ? 'Copiado!' : 'Copiar Chat'}
                                            </Button>

                                            <a
                                                href={`/overlay/chat/${match.match_id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex"
                                            >
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="border-gold/50 text-gold hover:bg-gold/10"
                                                >
                                                    <MessageSquare size={16} />
                                                    Abrir Chat
                                                </Button>
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}

                <div className="mt-8 p-4 bg-gray-900 border border-gray-800 rounded-lg">
                    <h3 className="text-sm font-bold text-gold uppercase mb-2">Como usar no OBS</h3>
                    <ol className="text-xs text-gray-400 space-y-1 list-decimal list-inside">
                        <li>Copie a URL do overlay desejado</li>
                        <li>No OBS, clique em "+" em Sources</li>
                        <li>Selecione "Browser"</li>
                        <li>Cole a URL copiada</li>
                        <li>Ajuste o tamanho e posição conforme necessário</li>
                    </ol>
                </div>
            </div>
        </div>
    );
}
