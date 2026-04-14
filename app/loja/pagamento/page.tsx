import Link from "next/link";
import PremiumCard from "@/components/premium-card";

export default function LojaPagamentoPage() {
  return (
    <section className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-black py-12">
      <div className="container mx-auto max-w-3xl px-4">
        <PremiumCard>
          <div className="space-y-4 p-6 md:p-8">
            <p className="text-xs uppercase tracking-[0.2em] text-gold/80">Loja</p>
            <h1 className="text-3xl font-black uppercase text-white">Pagamento indisponível</h1>
            <p className="text-sm text-zinc-300">
              Compras em dinheiro foram desativadas. No momento, a loja aceita apenas itens resgatados com moedas do site.
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <Link
                href="/loja"
                className="rounded-lg border border-gold bg-gold px-4 py-2 text-sm font-black uppercase text-black transition hover:opacity-90"
              >
                Voltar para Loja
              </Link>
            </div>
          </div>
        </PremiumCard>
      </div>
    </section>
  );
}
