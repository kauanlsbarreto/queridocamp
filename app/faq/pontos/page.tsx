import Link from "next/link";
import { CircleAlert, Coins, LogIn, ShieldCheck, Trophy } from "lucide-react";

const steps = [
	{
		title: "Faca login no site pelo menos uma vez",
		text: "Esse primeiro login ativa sua conta no sistema e permite que seus pontos sejam registrados corretamente.",
		icon: LogIn,
	},
	{
		title: "Jogue a partida da Querida Fila",
		text: "Assim que a partida finalizar, o sistema valida a fila, identifica o time vencedor e calcula os pontos.",
		icon: Trophy,
	},
	{
		title: "Pontuacao vai para seu perfil",
		text: "Os pontos entram automaticamente no perfil e atualizam ranking, historico e recompensas da plataforma.",
		icon: Coins,
	},
];

const rules = [
	"Apenas jogadores do time vencedor recebem pontos.",
	"E necessario ter feito login no site pelo menos uma vez.",
	"A atualizacao pode levar alguns minutos apos o fim da partida.",
	"Se seus pontos nao aparecerem, fale com a equipe admin para verificacao.",
];

export default function FaqPontosPage() {
	return (
		<main className="min-h-screen bg-[#070b12] text-white">
			<section className="relative isolate overflow-hidden border-b border-cyan-400/20">
				<div
					aria-hidden="true"
					className="pointer-events-none absolute inset-0 opacity-70"
					style={{
						background:
							"radial-gradient(1200px 420px at 0% -10%, rgba(35,211,255,0.22), transparent 65%), radial-gradient(900px 420px at 100% 0%, rgba(255,140,0,0.16), transparent 60%), linear-gradient(120deg, #0a1220 0%, #10111a 45%, #090b11 100%)",
					}}
				/>

				<div className="relative mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-16 md:px-8 md:py-24">
					<span className="inline-flex w-fit items-center rounded-full border border-cyan-300/40 bg-cyan-400/10 px-4 py-1 text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">
						Guia da Pontuacao
					</span>

					<div className="grid gap-10 md:grid-cols-[1.2fr_0.8fr] md:items-end">
						<div>
							<h1
								className="text-4xl font-black uppercase leading-tight text-white md:text-6xl"
								style={{ fontFamily: "Bebas Neue, Rajdhani, Teko, sans-serif", letterSpacing: "0.03em" }}
							>
								Como Funciona a Moeda e os Pontos da Querida Fila
							</h1>
							<p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/80 md:text-base">
								A pontuacao e calculada apos o encerramento da partida. Para receber seus pontos corretamente, voce
								precisa ter feito login no site ao menos uma vez.
							</p>
						</div>

						<div className="rounded-2xl border border-cyan-300/25 bg-black/35 p-5 backdrop-blur-sm">
							<div className="flex items-start gap-3">
								<CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-cyan-200" />
								<div>
									<p className="text-sm font-semibold uppercase tracking-wider text-cyan-100">Regra obrigatoria</p>
									<p className="mt-2 text-sm leading-relaxed text-white/85">
										Se voce nunca entrou no site, seus pontos podem nao aparecer. Faca login uma vez e a partir dai a
										pontuacao passa a cair normalmente nas proximas partidas.
									</p>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			<section className="mx-auto grid w-full max-w-6xl gap-5 px-6 py-12 md:grid-cols-3 md:px-8">
				{steps.map((step, index) => {
					const Icon = step.icon;
					return (
						<article
							key={step.title}
							className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/10 to-white/5 p-6"
						>
							<div
								aria-hidden="true"
								className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
								style={{
									background:
										"linear-gradient(130deg, rgba(35,211,255,0.18), rgba(35,211,255,0) 40%, rgba(255,140,0,0.12) 90%)",
								}}
							/>
							<div className="relative">
								<div className="mb-5 flex items-center justify-between">
									<span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">Passo {index + 1}</span>
									<Icon className="h-5 w-5 text-cyan-200" />
								</div>
								<h2 className="text-xl font-bold uppercase leading-snug text-white" style={{ fontFamily: "Rajdhani, Teko, sans-serif" }}>
									{step.title}
								</h2>
								<p className="mt-3 text-sm leading-relaxed text-white/75">{step.text}</p>
							</div>
						</article>
					);
				})}
			</section>

			<section className="mx-auto grid w-full max-w-6xl gap-8 px-6 pb-16 md:grid-cols-[1.1fr_0.9fr] md:px-8">
				<article className="rounded-2xl border border-white/10 bg-[#0a1320] p-6 md:p-8">
					<div className="mb-4 flex items-center gap-3">
						<ShieldCheck className="h-5 w-5 text-cyan-200" />
						<h3 className="text-2xl font-black uppercase" style={{ fontFamily: "Rajdhani, Teko, sans-serif" }}>
							Regras da Pontuacao
						</h3>
					</div>
					<ul className="space-y-3 text-sm text-white/85">
						{rules.map((rule) => (
							<li key={rule} className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
								{rule}
							</li>
						))}
					</ul>
				</article>

				<article className="relative overflow-hidden rounded-2xl border border-orange-300/25 bg-[#1a1410] p-6 md:p-8">
					<div
						aria-hidden="true"
						className="absolute inset-0 opacity-60"
						style={{
							background:
								"radial-gradient(500px 260px at 95% 0%, rgba(255,153,0,0.22), transparent 60%), radial-gradient(460px 260px at 0% 100%, rgba(31,217,255,0.16), transparent 60%)",
						}}
					/>
					<div className="relative">
						<p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-200">Ainda sem pontuar?</p>
						<h3 className="mt-2 text-2xl font-black uppercase leading-tight" style={{ fontFamily: "Rajdhani, Teko, sans-serif" }}>
							Checklist Rapido
						</h3>
						<ol className="mt-4 space-y-3 text-sm text-white/85">
							<li>1. Confirme que voce fez login no site com a conta correta da FACEIT.</li>
							<li>2. Verifique se a partida pertence a fila oficial da Querida Fila.</li>
							<li>3. Aguarde alguns minutos para a atualizacao da pontuacao.</li>
							<li>4. Se continuar pendente, fale com a equipe admin.</li>
						</ol>

						<Link
							href="/queridafila/partidas"
							className="mt-6 inline-flex items-center rounded-lg border border-orange-300/50 bg-orange-400/10 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-orange-100 transition hover:bg-orange-400/20"
						>
							Ver partidas recentes
						</Link>
					</div>
				</article>
			</section>
		</main>
	);
}
