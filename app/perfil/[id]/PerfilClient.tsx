"use client"

import { useState, useEffect } from 'react';
import Image from 'next/image';
import PremiumCard from '@/components/premium-card';
import { Button } from '@/components/ui/button';
import { Trophy, Crown, Medal, Ticket } from 'lucide-react';
import PlayerMatches from './PlayerMatches';

const SPECIAL_ROLES: Record<string, { emoji: string; bannerLabel: string; bannerGradient: string; bannerText: string; avatarBorder: string; avatarGlow: string }> = {
  '0124bfce-db9e-4d4f-b3f4-b66084a8a484': {
    emoji: '👑',
    bannerLabel: 'FUNDADOR & DONO',
    bannerGradient: 'from-yellow-400 to-amber-500',
    bannerText: 'text-black',
    avatarBorder: 'border-yellow-400',
    avatarGlow: 'shadow-[0_0_40px_rgba(251,191,36,0.5)]',
  },
  'fcb1b15c-f3d4-47d1-bd27-b478b7ada9ee': {
    emoji: '',
    bannerLabel: 'ADMINISTRADOR',
    bannerGradient: 'from-purple-500 to-violet-600',
    bannerText: 'text-white',
    avatarBorder: 'border-purple-500',
    avatarGlow: 'shadow-[0_0_40px_rgba(168,85,247,0.5)]',
  },
};

export default function PerfilClient({ player, initialConquistas, upcomingMatches, teamName, playerStatsList, adminView = false }: { player: any, initialConquistas: any[], upcomingMatches?: any[], teamName?: string, playerStatsList?: any[], adminView?: boolean }) {
    const [codigo, setCodigo] = useState('');
    const [adicionadosInput, setAdicionadosInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [savingAdicionados, setSavingAdicionados] = useState(false);
    const [status, setStatus] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
    const [adminStatus, setAdminStatus] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
    const [conquistas, setConquistas] = useState(initialConquistas);
    const [faceitLevel, setFaceitLevel] = useState<number | null>(player.id === 0 ? -1 : null);
    const [isChallenger, setIsChallenger] = useState(false);
    const [isOwnProfile, setIsOwnProfile] = useState(false);
    const [userAdminLevel, setUserAdminLevel] = useState(0);

    const role = SPECIAL_ROLES[player?.faceit_guid || ''] || null;
    const hasFaceitLink = Boolean(player?.faceit_guid && player?.nickname);
    const canManageThisProfile = isOwnProfile || (!isOwnProfile && userAdminLevel === 1);

    const handleFaceitLink = async () => {
        localStorage.setItem('faceit_link_player_id', String(player?.id || ''));
        const clientId = '6f737cca-6960-4f17-9493-4ff66340dd9b';
        const redirectUri = 'https://queridocamp.com.br/auth/faceit/callback';
        const codeVerifier = crypto.randomUUID();
        localStorage.setItem('faceit_code_verifier', codeVerifier);

        const data = new TextEncoder().encode(codeVerifier);
        const digest = await crypto.subtle.digest('SHA-256', data);
        const codeChallenge = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(digest)) as any))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        const url = new URL('https://accounts.faceit.com/accounts/dialog/oauth');
        url.searchParams.set('response_type', 'code');
        url.searchParams.set('client_id', clientId);
        url.searchParams.set('redirect_uri', redirectUri);
        url.searchParams.set('code_challenge', codeChallenge);
        url.searchParams.set('code_challenge_method', 'S256');
        url.searchParams.set('scope', 'openid email profile');

        window.open(url.toString(), 'FaceitLogin', 'width=600,height=700');
    };

    useEffect(() => {
        const fetchLevel = async () => {
            if (player.id === 0) return;
            if (player?.faceit_guid) {
                try {
                    const res = await fetch(`https://open.faceit.com/data/v4/players/${player.faceit_guid}`, {
                        headers: { 'Authorization': 'Bearer 7b080715-fe0b-461d-a1f1-62cfd0c47e63' }
                    });
                    if (res.ok) {
                        const data = await res.json();
                        if (data.games?.cs2?.skill_level) {
                            setFaceitLevel(data.games.cs2.skill_level);

                            if (data.games.cs2.skill_level === 10 && data.games.cs2.region) {
                                try {
                                    const rankRes = await fetch(`https://open.faceit.com/data/v4/rankings/games/cs2/regions/${data.games.cs2.region}/players/${player.faceit_guid}`, {
                                        headers: { 'Authorization': 'Bearer 7b080715-fe0b-461d-a1f1-62cfd0c47e63' }
                                    });
                                    if (rankRes.ok) {
                                        const rankData = await rankRes.json();
                                        if (rankData.position && rankData.position <= 1000) {
                                            setIsChallenger(true);
                                        }
                                    }
                                } catch (e) {
                                    console.error("Failed to fetch rank", e);
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error("Failed to fetch Faceit level", error);
                }
            }
        };
        fetchLevel();

        setAdicionadosInput(String(player?.adicionados || ''));

        const storedUser = localStorage.getItem("manual_user") || localStorage.getItem("faceit_user");
        if (storedUser) {
            try {
                const user = JSON.parse(storedUser);
                if (String(user.id) === String(player.id)) {
                    setIsOwnProfile(true);
                    if (user.faceit_guid === player.faceit_guid && user.nickname !== player.nickname) {
                        const updatedUser = { ...user, nickname: player.nickname };
                        localStorage.setItem("faceit_user", JSON.stringify(updatedUser));
                    }
                }

                const localAdminLevel = Number(user.Admin || user.admin || 0);
                if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
                    setUserAdminLevel(localAdminLevel);
                } else if (user.faceit_guid) {
                    fetch(`/api/admin/players?faceit_guid=${user.faceit_guid}`)
                        .then((res) => res.json())
                        .then((data) => {
                            if (data && typeof data.admin === 'number') {
                                setUserAdminLevel(data.admin);
                            } else {
                                setUserAdminLevel(localAdminLevel);
                            }
                        })
                        .catch(() => setUserAdminLevel(localAdminLevel));
                } else {
                    setUserAdminLevel(localAdminLevel);
                }
            } catch (e) {
                console.error("Failed to parse user session", e);
            }
        }
    }, [player]);

    const handleResgatar = async () => {
        if (!codigo) return;
        setLoading(true);
        setStatus(null);
        try {
            const res = await fetch('/api/conquistas/resgatar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ codigo: codigo.trim(), playerId: player.id }),
            });
            const data = await res.json();
            if (res.ok) {
                setStatus({ msg: 'Conquista resgatada!', type: 'success' });
                setCodigo('');
                setConquistas(prev => [data.novaConquista, ...prev]);
            } else {
                setStatus({ msg: data.message || 'Código inválido', type: 'error' });
            }
        } catch (err) {
            setStatus({ msg: 'Erro na conexão', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateAdicionados = async () => {
        if (!canManageThisProfile) return;

        setSavingAdicionados(true);
        setAdminStatus(null);

        try {
            const res = await fetch('/api/admin/players/update-adicionados', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: player.id,
                    adicionados: adicionadosInput.trim(),
                }),
            });

            if (res.ok) {
                setAdminStatus({ msg: 'Adicionados atualizados com sucesso!', type: 'success' });
            } else {
                const data = await res.json().catch(() => null);
                setAdminStatus({ msg: data?.message || 'Falha ao atualizar adicionados', type: 'error' });
            }
        } catch (e) {
            console.error('Erro ao atualizar adicionados', e);
            setAdminStatus({ msg: 'Erro na conexao', type: 'error' });
        } finally {
            setSavingAdicionados(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] pt-24 pb-12">
            <div className="container mx-auto px-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1">
                        <div className="sticky top-24">
                            <PremiumCard>
                                <div className="p-8 flex flex-col items-center text-center">
                                    <div className="relative mb-6">
                                        {role && (
                                            <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-10 text-4xl leading-none pointer-events-none select-none">
                                                {role.emoji}
                                            </div>
                                        )}
                                        <div className={`relative w-40 h-40 rounded-full overflow-hidden border-4 ${role ? role.avatarBorder : 'border-gold'} ${role ? role.avatarGlow : ''}`}>
                                            <Image 
                                                src={player?.avatar || '/images/cs2-player.png'} 
                                                alt={player?.nickname || "Player"} 
                                                fill 
                                                className="object-cover" 
                                                unoptimized 
                                            />
                                        </div>
                                    </div>
                                    <h1 className="text-3xl font-black text-white uppercase italic tracking-wider mb-2">
                                        {player?.nickname}
                                    </h1>
                                    {role && (
                                        <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest mb-3 bg-gradient-to-r ${role.bannerGradient} ${role.bannerText}`}>
                                            {role.emoji} {role.bannerLabel}
                                        </div>
                                    )}
                                    
                                    {(faceitLevel || player.id === 0 || player.faceit_level_image) && (
                                        <div className="mb-4 flex flex-col items-center justify-center" title={`Faceit Level ${faceitLevel ?? 0}`}>
                                            <img 
                                                src={player.faceit_level_image || (player.id === 0 ? "/faceitlevel/-1.png" : (isChallenger ? "/faceitlevel/challenger.png" : `/faceitlevel/${faceitLevel ?? 0}.png`))} 
                                                alt={`Level ${faceitLevel ?? 0}`} 
                                                width={36} 
                                                height={36} 
                                            />
                                            {(faceitLevel ?? 0) !== 0 && <span className="text-gold font-bold text-sm mt-2">Level {faceitLevel}</span>}
                                        </div>
                                    )}
                                    
                                    <p className="text-sm text-zinc-500 font-mono mb-6 uppercase tracking-tighter">
                                        Querido ID: {player?.id}
                                    </p>
                                    
                                    {player.id !== 0 && hasFaceitLink && (
                                        <Button asChild className="w-full bg-[#ff5500] hover:bg-[#e04b00] text-white font-bold py-6 rounded-xl mb-4">
                                            <a href={`https://www.faceit.com/pt/players/${player?.nickname}`} target="_blank">
                                                Perfil Faceit
                                            </a>
                                        </Button>
                                    )}

                                    {player.id !== 0 && !hasFaceitLink && isOwnProfile && (
                                        <Button onClick={handleFaceitLink} className="w-full bg-[#ff5500] hover:bg-[#e04b00] text-white font-bold py-6 rounded-xl mb-4">
                                            Vincular Faceit
                                        </Button>
                                    )}

                                    {canManageThisProfile && (
                                    <div className="w-full pt-4 border-t border-white/10 mt-2">
                                        <label className="text-[10px] text-zinc-400 uppercase font-black tracking-widest mb-3 block">
                                            {isOwnProfile ? 'Resgatar:' : 'Resgatar no perfil:'}
                                        </label>
                                        <div className="flex flex-col gap-2">
                                            <input 
                                                type="text" 
                                                value={codigo} 
                                                onChange={(e) => setCodigo(e.target.value)}
                                                placeholder="DIGITE O CÓDIGO" 
                                                className="bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:border-gold/50 outline-none uppercase font-mono text-center"
                                            />
                                            <Button 
                                                onClick={handleResgatar} 
                                                disabled={loading} 
                                                className="bg-gold hover:bg-gold/80 text-black font-black uppercase text-xs py-5 rounded-lg flex gap-2"
                                            >
                                                <Ticket size={16} />
                                                {loading ? 'Validando...' : 'Colocar codigo'}
                                            </Button>
                                            {status && (
                                                <p className={`text-[10px] font-bold uppercase mt-2 ${status.type === 'success' ? 'text-green-400' : 'text-red-500'}`}>
                                                    {status.msg}
                                                </p>
                                            )}
                                        </div>

                                        {!isOwnProfile && userAdminLevel === 1 && (
                                            <div className="mt-4 pt-4 border-t border-white/10">
                                                <label className="text-[10px] text-zinc-400 uppercase font-black tracking-widest mb-3 block">
                                                    Adicionados:
                                                </label>
                                                <div className="flex flex-col gap-2">
                                                    <input
                                                        type="text"
                                                        value={adicionadosInput}
                                                        onChange={(e) => setAdicionadosInput(e.target.value)}
                                                        placeholder="EX: QCS-CADEIRANTE, MVP-2026"
                                                        className="bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:border-gold/50 outline-none uppercase font-mono"
                                                    />
                                                    <Button
                                                        onClick={handleUpdateAdicionados}
                                                        disabled={savingAdicionados}
                                                        className="bg-blue-600 hover:bg-blue-500 text-white font-black uppercase text-xs py-5 rounded-lg"
                                                    >
                                                        {savingAdicionados ? 'Salvando...' : 'Salvar adicionados'}
                                                    </Button>
                                                    {adminStatus && (
                                                        <p className={`text-[10px] font-bold uppercase mt-2 ${adminStatus.type === 'success' ? 'text-green-400' : 'text-red-500'}`}>
                                                            {adminStatus.msg}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    )}
                                </div>
                            </PremiumCard>

                            <div className="mt-6">
                                <PremiumCard>
                                    <div className="p-6">
                                        <div className="flex items-center justify-center gap-2 mb-6 text-gold">
                                            <Trophy size={20} />
                                            <h3 className="text-lg font-bold uppercase tracking-widest">Hall da Fama</h3>
                                        </div>
                                        <div className="space-y-3">
                                            {conquistas.length > 0 ? (
                                                conquistas.map((conq, i) => {
                                                    const nome = String(conq.nome || conq.label || conq.codigo || 'Conquista');
                                                    const isVice = nome.toUpperCase().startsWith('VICE');
                                                    const hasImage = Boolean(conq.imagem);
                                                    return (
                                                        <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-4 hover:border-gold/40 transition-all">
                                                            {hasImage ? (
                                                                <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-white/10 shrink-0">
                                                                    <Image
                                                                        src={conq.imagem}
                                                                        alt={nome}
                                                                        fill
                                                                        className="object-cover"
                                                                        unoptimized
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <div className={isVice ? "text-blue-400" : "text-gold"}>
                                                                    {conq.tipo === 'MVP' ? <Medal size={28} /> : <Crown size={28} />}
                                                                </div>
                                                            )}
                                                            <div className="text-left">
                                                                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${isVice ? "text-blue-400 bg-blue-400/10" : "text-gold bg-gold/10"}`}>
                                                                    {conq.tipo || 'CONQUISTA'}
                                                                </span>
                                                                <p className="text-white font-bold text-sm uppercase mt-1">{nome}</p>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            ) : (
                                                <p className="text-center text-[10px] text-zinc-500 uppercase font-bold py-4">Sem troféus ainda</p>
                                            )}
                                        </div>
                                    </div>
                                </PremiumCard>
                            </div>
                        </div>
                    </div>
                    <div className="lg:col-span-2">
                        {(player.id !== 0 || player.faceit_guid) && (
                            <PlayerMatches 
                                faceitId={player?.faceit_guid} 
                                upcomingMatches={upcomingMatches} 
                                teamName={teamName} 
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}