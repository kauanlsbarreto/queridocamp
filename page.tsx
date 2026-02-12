import mysql from 'mysql2/promise';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import HeroBanner from '@/components/hero-banner';
import PremiumCard from '@/components/premium-card';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';

// Este pool pode ser compartilhado em um arquivo lib/db.ts
const databaseUrl = process.env.DATABASE_URL || "mysql://root:YMQZnBJRGFhRYSfjSZjFMGTegALnUfoS@nozomi.proxy.rlwy.net:36657/railway";
const dbPool = mysql.createPool(databaseUrl);

interface PlayerProfile {
    id: number;
    nickname: string;
    avatar: string;
    faceit_guid: string;
}

async function getPlayer(id: string): Promise<PlayerProfile | null> {
    // Validação para garantir que o ID é um número
    if (!/^\d+$/.test(id)) {
        return null;
    }

    try {
        const connection = await dbPool.getConnection();
        const [rows]: any = await connection.execute(
            'SELECT id, nickname, avatar, faceit_guid FROM players WHERE id = ?',
            [id]
        );
        connection.release();

        if (rows.length > 0) {
            const player = rows[0] as PlayerProfile;

            if (id === '0') {
                player.nickname = "Admin"; // Nickname Personalizado
                player.avatar = "https://distribution.faceit-cdn.net/images/183bacac-0e2c-4ade-867c-cb5df6e55058.jpg"; // Avatar Personalizado
            }
            return player;
        }
        return null;
    } catch (error) {
        console.error("Falha ao buscar jogador:", error);
        return null;
    }
}

export default async function PerfilPage({ params }: { params: { id: string } }) {
    const player = await getPlayer(params.id);

    if (!player) {
        notFound();
    }

    return (
        <div>
            <HeroBanner 
                title={player.nickname.toUpperCase()} 
                subtitle="Perfil do Jogador" 
            />

            <section className="py-16 bg-gradient-to-b from-black to-gray-900">
                <div className="container mx-auto px-4 max-w-2xl">
                    <PremiumCard>
                        <div className="p-8 flex flex-col items-center">
                            <div className="relative w-32 h-32 rounded-full overflow-hidden border-2 border-gold mb-6">
                                <Image
                                    src={player.avatar || '/placeholder.svg'}
                                    alt={`Avatar de ${player.nickname}`}
                                    fill
                                    className="object-cover"
                                    unoptimized
                                />
                            </div>
                            <h2 className="text-3xl font-bold text-white mb-2">{player.nickname}</h2>
                            <p className="text-sm text-gray-400 mb-6">ID do Jogador: {player.id}</p>
                            
                            <div className="w-full mt-4 border-t border-gold/20 pt-6 text-center">
                                <h3 className="text-xl font-bold text-gold mb-4">Estatísticas (Em Breve)</h3>
                                <p className="text-gray-300">
                                    Em breve, você poderá ver as estatísticas de desempenho do jogador no campeonato aqui.
                                </p>
                            </div>

                            {player.id !== 0 && (
                                <Button asChild className="mt-8 bg-orange-500 text-white font-bold py-2 px-6 rounded-md hover:bg-orange-600 transition-colors">
                                    <a href={`https://www.faceit.com/pt/players/${player.nickname}`} target="_blank" rel="noopener noreferrer">
                                        Ver Perfil na Faceit <ExternalLink size={16} className="ml-2" />
                                    </a>
                                </Button>
                            )}
                        </div>
                    </PremiumCard>
                </div>
            </section>
        </div>
    );
}