"use client"

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";

export default function AnuncioModal() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (
      pathname === "/inscricao" ||
      pathname === "/"
    ) {
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [pathname]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60">
      <div className="relative rounded-2xl shadow-2xl border-4 border-orange-400 animate-glow-orange bg-white overflow-hidden">
        <button
          onClick={() => setOpen(false)}
          className="absolute top-2 right-2 z-10 bg-black/70 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-black/90 transition"
          aria-label="Fechar anúncio"
        >
          <span style={{fontSize: 22, fontWeight: 900}}>×</span>
        </button>
        <div
          className="cursor-pointer"
          onClick={() => {
            setOpen(false);
            router.push("/queridafila/inscricao");
          }}
        >
          <Image
            src="/queridafila/anuncio.png"
            alt="Anúncio Inscrição"
            width={400}
            height={400}
            className="block max-w-full h-auto select-none"
            priority
          />
        </div>
      </div>
      <style jsx global>{`
        @keyframes glow-orange {
          0% { box-shadow: 0 0 16px 4px #ff9900cc; }
          50% { box-shadow: 0 0 32px 8px #ff9900ee; }
          100% { box-shadow: 0 0 16px 4px #ff9900cc; }
        }
        .animate-glow-orange {
          animation: glow-orange 1.5s infinite;
        }
      `}</style>
    </div>
  );
}
