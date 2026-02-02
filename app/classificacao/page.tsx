import HeroBanner from '@/components/hero-banner'
import RankingTable from './ranking-table'

export const revalidate = 60

async function getTeams() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/classificacao`, {
    next: { revalidate: 60 },
  })

  if (!res.ok) return []
  return res.json()
}

export default async function Classificacao() {
  const teams = await getTeams()

  return (
    <div className="min-h-screen bg-black">
      <HeroBanner
        title="Classificação"
        subtitle="Acompanhe a tabela atualizada do campeonato"
      />

      <section className="py-16 bg-gradient-to-b from-black to-gray-900">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <RankingTable teams={teams} />
          </div>
        </div>
      </section>
    </div>
  )
}
