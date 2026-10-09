export type Language = "en" | "zh";
export type Domain = "events" | "faceit";
export type Section = "data" | "rankings" | "compare" | "analysis";
export type EventFamily = "major" | "iem" | "epl" | "blast" | "pgl";
export type Standing = { rank: number; points: number; name: string; roster: string[]; sourceUrl: string };
export type StandingsFeed = { items: Standing[]; snapshotDate: string; sourceUrl: string; stale: boolean; updatedAt: string | null };
export type EventMatch = {
  id: string; name: string; event: string; family: EventFamily;
  status: "upcoming" | "running" | "finished"; beginsAt: string | null;
  bestOf: number | null; teams: Array<{ id: string; name: string; score: number | null }>;
  detailedStats: boolean;
};
export type EventsFeed = {
  items: EventMatch[]; status: "ready" | "unconfigured" | "unavailable" | "partial";
  updatedAt: string | null; source: "PandaScore"; scanned: number; bounded: boolean;
};
export type PlayerSample = Partial<import('./pro-lab').AdvancedStats> & {
  id: string; playedAt: string | null; result: "W" | "L" | null;
  mode: string; score: string | null; opponent: string | null;
  competitionName: string; map: string | null; kills: number | null;
  deaths: number | null; assists: number | null; kd: number | null;
  kr: number | null; adr: number | null; headshots: number | null;
  advancedObservedAt?:string|null;
  advancedArchiveFields?:Array<keyof import('./pro-lab').AdvancedStats>;
};
export type PlayerProfile = {
  id: string; nickname: string; faceitNickname: string; team: string;
  avatar: string | null; country: string | null; elo: number | null; level: number | null;
  faceitUrl: string | null;
  ranking: { region: string | null; regionPosition: number | null; countryPosition: number | null };
  recentSummary: { sampleSize: number; wins: number; losses: number; winRate: number | null; streak: string | null };
  recentPerformance: { sampleSize: number; kd: number | null; kr: number | null; adr: number | null; headshots: number | null };
  lifetime: Record<string, number | null>;
  recentMaps: Array<{ map: string; matches: number; winRate: number; kd: number | null; adr: number | null }>;
  mapPool: Array<{ map: string; matches: number | null; winRate: number | null; averageKd: number | null; adr: number | null }>;
  frequentTeammates: Array<{ id: string; nickname: string; matches: number; winRate: number }>;
  recentMatches: PlayerSample[];
  archive?: { observedAt: string; storage: 'snapshot' | 'persistent'; stale: boolean };
};
export type LivePlayer = {
  id: string; nickname: string; faceitNickname: string; team: string; avatar: string | null;
  elo: number | null; level: number | null; dataAvailable?: boolean;
  ranking: { region: string | null; position: number | null };
  recentMatches: Array<{ id: string; result: "W" | "L" | "D" | null }>;
};
