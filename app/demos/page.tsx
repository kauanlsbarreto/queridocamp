import Image from "next/image";
import { headers } from "next/headers";
import PremiumCard from "@/components/premium-card";
import React from "react";

const matchesData = [
  {
    teams: ["Elo Imaginário", "Uns&Outros"],
    url: "https://drive.google.com/drive/folders/1zGZmITgF7AD5o18XzadJhbX6vWA0taec?usp=sharing",
  },
  {
    teams: ["Lafise", "22Cao Na Chapa"],
    url: "https://drive.google.com/drive/folders/1Nu9nEP14SQe8LH8dxnb0FBg0jWt_a8Sd?usp=sharing",
  },
  {
    teams: ["La Fab", "União"],
    url: "https://drive.google.com/drive/folders/1uR4FRRcVb6PG09YF-CGBviLLTNVdguHE?usp=sharing",
  },
  {
    teams: ["Contabilize", "Passos Jr"],
    url: "https://drive.google.com/drive/folders/1ztIjdUv65Nc2uVsrosCIxh-5brwBy8xP?usp=sharing",
  },
  {
    teams: ["Lafise", "Contabilize"],
    url: "https://drive.google.com/drive/folders/1rw1oZQLsJFBeL7dLOmNnjkByHRFYq1Gs?usp=sharing",
  },
  {
    teams: ["La Fab", "Elo Imaginário"],
    url: "https://drive.google.com/drive/folders/1gaxpurgLUlBFFzq0jgfC4WR0Hok2Hmn4?usp=sharing",
  },
];

const finalMatchData = {
  teams: ["Contabilize", "Elo Imaginário"],
  url: "https://drive.google.com/drive/folders/1cg2Fpo9_I8kPBX50yZe1_tB5a6skOgKi?usp=sharing",
};

async function getTeamsFromApi() {
  const headersObj = await headers();
  const host = headersObj.get("host");
  const protocol = host?.includes("localhost") ? "http" : "https";
  const url = `${protocol}://${host}/api/classificacao`;
  
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  return data.teams || [];
}

type Team = {
  id: number;
  name: string;
  logo: string;
  wins: number;
  losses: number;
  points: number;
  rounds: string;
};

function getTeamInfo(teams: Team[], name: string): Team | undefined {
  const norm = (str: string) => str.toLowerCase().replace(/\s+/g, "");
  return teams.find((t: Team) => norm(t.name) === norm(name));
}

export default async function DownloadDemosPage() {
  const teams = await getTeamsFromApi();

  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-gray-900 py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gold text-center mb-8">Download de Demos</h1>
        {matchesData.map((match, idx) => (
          <PremiumCard key={idx}>
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-6">
              <div className="flex items-center gap-4 flex-1">
                {match.teams.map((teamName, i) => {
                  const team = getTeamInfo(teams, teamName);
                  return (
                    <React.Fragment key={teamName}>
                      <div className="flex flex-col items-center">
                        <div className="relative w-16 h-16 mb-2">
                          <Image src={team?.logo || "/placeholder.svg"} alt={teamName} fill className="object-contain rounded-lg bg-black/40" />
                        </div>
                        <span className="text-white font-semibold text-center text-sm whitespace-nowrap">{teamName}</span>
                      </div>
                      {i === 0 && <span className="mx-2 text-gold font-bold text-lg">×</span>} 
                    </React.Fragment>
                  );
                })}
              </div>
              <a
                href={match.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-gold hover:bg-yellow-400 text-black font-bold px-6 py-2 rounded-lg shadow transition-colors"
              >
                Baixar Demo
              </a>
            </div>
          </PremiumCard>
        ))}

        {/* Destaque da Final */}
        <PremiumCard className="scale-105 shadow-[0_0_30px_rgba(212,175,55,0.3)]">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-8 border-2 border-gold bg-gold/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-gold text-black px-4 py-1 font-black text-xs uppercase tracking-tighter rounded-bl-lg">
              Grande Final
            </div>
            <div className="flex items-center gap-4 flex-1">
              {finalMatchData.teams.map((teamName, i) => {
                const team = getTeamInfo(teams, teamName);
                return (
                  <div key={teamName} className="flex flex-col items-center">
                    <div className="relative w-16 h-16 mb-2">
                      <Image src={team?.logo || "/placeholder.svg"} alt={teamName} fill className="object-contain rounded-lg bg-black/40" />
                    </div>
                    <span className="text-gold font-bold text-center text-base whitespace-nowrap">{teamName}</span>
                  </div>
                );
              })}
              <span className="mx-2 text-gold font-extrabold text-xl">×</span>
            </div>
            <a
              href={finalMatchData.url}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-gold hover:bg-yellow-400 text-black font-bold px-6 py-2 rounded-lg shadow transition-colors border-2 border-gold"
            >
              Baixar Demo (Final)
            </a>
          </div>
        </PremiumCard>
      </div>
    </div>
  );
}
