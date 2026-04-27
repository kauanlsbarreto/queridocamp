import { Check, ChevronRight, Headphones, MessageCircle, Server, ShieldCheck, TerminalSquare } from "lucide-react"

import PremiumCard from "@/components/premium-card"
import SectionTitle from "@/components/section-title"

const whatsappNumber = "5579981333930"

const plans = [
	{
		name: "MD1",
		price: "R$ 10,00",
		duration: "Ideal para um confronto rapido",
		featured: false,
		support: false,
	},
	{
		name: "MD2",
		price: "R$ 15,00",
		duration: "Mais tempo para series equilibradas",
		featured: false,
		support: false,
	},
	{
		name: "MD3",
		price: "R$ 20,00",
		duration: "Formato classico para disputa completa",
		featured: true,
		support: false,
	},
	{
		name: "1 DIA",
		price: "R$ 35,00",
		duration: "Servidor liberado durante o dia inteiro",
		featured: false,
		support: true,
	},
	{
		name: "1 SEMANA",
		price: "R$ 80,00",
		duration: "Melhor opcao para rotina de treino",
		featured: false,
		support: true,
	},
] as const

const benefits = [
	{
		title: "Servidor com skin",
		description: "Entre em um servidor preparado para CS2 com ambientacao e configuracao alinhadas ao estilo da comunidade.",
		icon: Server,
	},
	{
		title: "Plugin do servidor",
		description: "Plugins essenciais ja habilitados para facilitar o setup das partidas e manter a experiencia redonda.",
		icon: ShieldCheck,
	},
	{
		title: "Acesso ao console",
		description: "Envie comandos direto no console para ajustar o servidor conforme a necessidade do seu treino ou confronto.",
		icon: TerminalSquare,
	},
	{
		title: "Suporte para treinos",
		description: "Nos planos de 1 dia e 1 semana, o time recebe suporte para organizar e tocar os treinos com mais tranquilidade.",
		icon: Headphones,
	},
] as const

function getWhatsappLink(planName: string) {
	const message = encodeURIComponent(`Ola, quero contratar o plano ${planName}`)
	return `https://wa.me/${whatsappNumber}?text=${message}`
}

export default function AlugarServidorPage() {
	return (
		<main className="relative overflow-hidden bg-transparent text-white">
			<div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(236,161,73,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(231,106,33,0.14),transparent_28%)]" />

			<section className="border-b border-white/5">
				<div className="container relative py-20 md:py-28">
					<div className="absolute left-0 top-10 h-32 w-32 rounded-full bg-gold/10 blur-3xl" />
					<div className="absolute right-10 top-0 h-40 w-40 rounded-full bg-gold-dark/10 blur-3xl" />

					<div className="max-w-4xl space-y-8">
							<div className="space-y-5">
								<h1 className="max-w-3xl text-4xl font-black leading-tight text-white md:text-6xl">
									Alugue seu servidor de CS2 com a cara da QueridoCamp
								</h1>
								<p className="max-w-2xl text-lg leading-8 text-gray-300 md:text-xl">
									Escolha o formato da sua serie, feche pelo WhatsApp e jogue em um servidor pronto para treino,
									camp e desafio fechado.
								</p>
							</div>

							<div className="flex flex-wrap gap-3 text-sm text-gray-200">
								<span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">Setup agil</span>
								<span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">Console liberado</span>
								<span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">Suporte nos planos longos</span>
							</div>
					</div>
				</div>
			</section>

			<section className="py-20">
				<div className="container">
					<SectionTitle
						title="Planos de aluguel"
						subtitle="Escolha seu plano"
						description="Todos os planos contam com servidor preparado para CS2, plugins essenciais e botao direto para contratacao."
					/>

					<div className="grid gap-6 md:grid-cols-2 xl:grid-cols-5">
						{plans.map((plan, index) => (
							<PremiumCard
								key={plan.name}
								delay={index * 0.08}
								className={plan.featured ? "border-gold/40 bg-[#0a1520] shadow-lg shadow-gold/10" : "bg-[#08111b]/90"}
							>
								<div className="flex h-full flex-col p-6">
									<div className="mb-6 flex items-start justify-between gap-3">
										<div>
											<p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold/70">Plano</p>
											<h3 className="mt-2 text-3xl font-black text-white">{plan.name}</h3>
										</div>
										{plan.featured ? (
											<span className="rounded-full bg-gold px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-black">
												Destaque
											</span>
										) : null}
									</div>

									<div className="mb-5">
										<p className="text-4xl font-black text-gold">{plan.price}</p>
										<p className="mt-2 min-h-12 text-sm leading-6 text-gray-300">{plan.duration}</p>
									</div>

									<div className="mb-6 space-y-3 text-sm text-gray-200">
										<div className="flex items-start gap-3">
											<Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
											<span>Servidor com skin</span>
										</div>
										<div className="flex items-start gap-3">
											<Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
											<span>Plugin do servidor</span>
										</div>
										<div className="flex items-start gap-3">
											<Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
											<span>Acesso ao console para enviar comandos</span>
										</div>
										<div className="flex items-start gap-3">
											<Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
											<span className={plan.support ? "text-white" : "text-gray-500"}>
												{plan.support ? "Suporte para os treinos incluso" : "Sem suporte dedicado para treinos"}
											</span>
										</div>
									</div>

									<a
										href={getWhatsappLink(plan.name)}
										target="_blank"
										rel="noreferrer"
										className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gold px-4 py-3 text-sm font-bold text-black transition-all duration-200 hover:bg-gold/90 hover:shadow-lg hover:shadow-gold/20"
									>
										Contratar
										<ChevronRight className="h-4 w-4" />
									</a>
								</div>
							</PremiumCard>
						))}
					</div>
				</div>
			</section>

			<section className="pb-24">
				<div className="container grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
					<div className="rounded-[2rem] border border-white/10 bg-[#08111b]/90 p-8 backdrop-blur-sm">
						<SectionTitle
							title="O que voce recebe"
							subtitle="Beneficios"
							description="A estrutura foi pensada para voce contratar rapido e entrar no servidor sem perder tempo com setup quebrado."
							centered={false}
						/>

						<div className="space-y-4">
							{benefits.map((benefit) => {
								const Icon = benefit.icon

								return (
									<div
										key={benefit.title}
										className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
									>
										<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gold/15 text-gold">
											<Icon className="h-5 w-5" />
										</div>
										<div>
											<h3 className="text-lg font-bold text-white">{benefit.title}</h3>
											<p className="mt-1 text-sm leading-6 text-gray-300">{benefit.description}</p>
										</div>
									</div>
								)
							})}
						</div>
					</div>

					<div className="relative overflow-hidden rounded-[2rem] border border-gold/20 bg-gradient-to-br from-[#101a24] via-[#0b121a] to-[#060d15] p-8">
						<div className="absolute right-0 top-0 h-36 w-36 rounded-full bg-gold/10 blur-3xl" />
						<div className="relative z-10">
							<p className="text-sm uppercase tracking-[0.35em] text-gold/80">Fluxo simples</p>
							<h2 className="mt-4 max-w-xl text-3xl font-black text-white md:text-4xl">
								Escolheu o plano, clicou em contratar e ja cai no WhatsApp com a mensagem pronta.
							</h2>
							<p className="mt-4 max-w-2xl text-base leading-8 text-gray-300">
								O botao de cada card abre a conversa com o numero e envia a mensagem com o nome
								exato do plano escolhido para acelerar o atendimento.
							</p>

							<div className="mt-8 grid gap-4 md:grid-cols-3">
								<div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
									<p className="text-sm font-semibold uppercase tracking-[0.2em] text-gold">01</p>
									<p className="mt-3 text-lg font-bold text-white">Selecione</p>
									<p className="mt-2 text-sm leading-6 text-gray-300">Compare os formatos e veja o que encaixa no seu treino ou confronto.</p>
								</div>
								<div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
									<p className="text-sm font-semibold uppercase tracking-[0.2em] text-gold">02</p>
									<p className="mt-3 text-lg font-bold text-white">Clique em contratar</p>
									<p className="mt-2 text-sm leading-6 text-gray-300">O link abre o WhatsApp com a mensagem pronta para o plano escolhido.</p>
								</div>
								<div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
									<p className="text-sm font-semibold uppercase tracking-[0.2em] text-gold">03</p>
									<p className="mt-3 text-lg font-bold text-white">Feche e jogue</p>
									<p className="mt-2 text-sm leading-6 text-gray-300">Nos planos longos, voce ainda conta com suporte para os treinos.</p>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>
		</main>
	)
}
