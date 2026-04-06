export type QueridaFilaPointsProjection = {
  playerId: string;
  adr: number;
  kd: number;
  kr: number;
  assists: number;
  hsPercent: number;
  mvps: number;
  doubleKills: number;
  tripleKills: number;
  quadroKills: number;
  pentaKills: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function calculateQueridaFilaPoints(
  players: QueridaFilaPointsProjection[],
): Map<string, number> {
  if (players.length === 0) {
    return new Map<string, number>();
  }

  const buildNormalizedMap = (selector: (player: QueridaFilaPointsProjection) => number) => {
    const values = players.map(selector);
    const min = Math.min(...values);
    const max = Math.max(...values);

    return new Map(
      players.map((player) => {
        if (max === min) {
          return [player.playerId, 0.5] as const;
        }

        return [player.playerId, (selector(player) - min) / (max - min)] as const;
      }),
    );
  };

  const multiKillMap = buildNormalizedMap(
    (player) =>
      player.doubleKills +
      player.tripleKills * 2 +
      player.quadroKills * 3.5 +
      player.pentaKills * 5,
  );
  const adrMap = buildNormalizedMap((player) => player.adr);
  const kdMap = buildNormalizedMap((player) => player.kd);
  const krMap = buildNormalizedMap((player) => player.kr);
  const mvpMap = buildNormalizedMap((player) => player.mvps);
  const assistsMap = buildNormalizedMap((player) => player.assists);
  const hsMap = buildNormalizedMap((player) => player.hsPercent);

  return new Map(
    players.map((player) => {
      const performanceScore =
        (adrMap.get(player.playerId) ?? 0.5) * 0.3 +
        (kdMap.get(player.playerId) ?? 0.5) * 0.25 +
        (krMap.get(player.playerId) ?? 0.5) * 0.15 +
        (mvpMap.get(player.playerId) ?? 0.5) * 0.1 +
        (multiKillMap.get(player.playerId) ?? 0.5) * 0.1 +
        (assistsMap.get(player.playerId) ?? 0.5) * 0.05 +
        (hsMap.get(player.playerId) ?? 0.5) * 0.05;

      const points = Math.round(5 + clamp(performanceScore, 0, 1) * 25);
      return [player.playerId, points] as const;
    }),
  );
}