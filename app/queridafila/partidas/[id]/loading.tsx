export default function QueridaFilaPartidaLoading() {
  return (
    <section className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-black py-10">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-7xl space-y-6 animate-pulse">
          <div className="h-5 w-40 rounded bg-white/10" />

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 md:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-3">
                <div className="h-7 w-32 rounded-full bg-gold/10" />
                <div className="h-10 w-80 max-w-full rounded bg-white/10" />
                <div className="h-5 w-56 rounded bg-white/10" />
              </div>

              <div className="flex items-center justify-center gap-4 md:gap-6">
                <div className="h-20 w-32 rounded-2xl bg-white/10" />
                <div className="h-10 w-10 rounded-full bg-white/10" />
                <div className="h-20 w-32 rounded-2xl bg-white/10" />
              </div>
            </div>
          </div>

          <div className="space-y-5">
            {[0, 1].map((index) => (
              <div key={index} className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                <div className="h-20 border-b border-white/10 bg-white/5" />
                <div className="overflow-hidden">
                  {[0, 1, 2, 3, 4].map((row) => (
                    <div key={row} className="h-16 border-t border-white/5 bg-black/20" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}