export type TrackedPlayer = {
  lookup: string;
  faceitPlayerId: string | null;
  display: string;
  team: string;
  role: string;
  country: string;
  focus: boolean;
  aliases: string[];
};

// Immutable FACEIT player IDs are the identity boundary. A display nickname is
// never sufficient evidence because renamed accounts can be squatted later.
const faceitPlayerIds: Record<string, string> = {
  donk: "e5e8e2a6-d716-4493-b949-e16965f41654",
  magixx: "1ace868a-d60c-46b8-a61e-f51d40d0305b",
  sh1ro: "168530f8-107a-4e0a-b641-655d2f1594de",
  tn1r: "f2013a83-2603-41a4-a6f0-0c716d52258c",
  zont1x: "93ddaace-5ff6-472f-88a1-769cf387f10a",
  karrigan: "68179dc7-9381-4264-a26c-52693400f1eb",
  kyousuke: "64000660-f2d2-4c9b-8e29-6ad5ec2b49cf",
  "m0nesy": "93306681-bce6-4369-8c41-e0bdba2597ed",
  niko: "19606e0c-137b-4885-a904-744fa12d25f6",
  teses: "c519d8f3-0c93-4476-af3e-38395ee7c297",
  apex: "de21905f-47e9-46c2-bfd2-e56f63795c87",
  flamez: "54278d39-3bdd-4ae7-8c4b-feb0adb3bee2",
  mezii: "58f68286-29eb-4108-97e5-2d8d96c65e05",
  ropz: "d3de50b6-c0fb-4d93-a304-0bdf7749ea5d",
  zywoo: "3b536dda-e3dd-40cd-baed-7e66ab050c8f",
  aleksib: "ccdeeb22-716d-462e-aed5-c6bf4a23b854",
  b1t: "a20678de-0c2d-4a9f-bf8e-3c856bceab45",
  im: "09701d83-187e-41e6-997d-a50b3e8d4d38",
  makazze: "18a04524-98bd-4a55-83d1-d348f79a8c60",
  w0nderful: "591e26a3-eb86-4d4c-afa8-b5754455dc03",
  kscerato: "c365e0fe-ae29-41d7-b331-ed8904e32d2b",
  molodoy: "8235d0e7-a5ba-47a0-998e-80f64c5a3bdf",
  yekindar: "3a4f7d12-c754-47e3-98d6-775460e9bb7b",
  yuurih: "bb9b1a15-7018-42fa-864b-48cc70e0d91b",
  jl: "23b6ffbb-86ec-47ab-acaa-9c76bed0af66",
  spinx: "a6e8dc26-039b-4c8e-96d6-94dcd6b273e9",
  torzsi: "21ee0d80-64f6-4277-80b9-c734d92a2880",
  xelex: "fb1af1d5-eee3-46e3-9939-01df9420b9d6",
  xertion: "e970f4bb-e5f7-4cc5-abc5-8afb52e435bf",
  art: "ae024156-2546-4b7a-a4e8-f518c35d3c72",
  dumau: "9ffb20d8-d103-42f8-b31c-4537e7586fe4",
  latto: "0c715f3d-bd25-4e2a-af9d-2477f0ec3aa4",
  n1ssim: "46da2e0a-0436-448a-b704-24f5c1f9d14b",
  saadzin: "71ea9955-8400-4553-87a5-4c325923d21f",
  maj3r: "c534cae2-d0aa-4c67-a2c0-29ecf0532ad5",
  soulfly: "a55ef48c-ee6a-4801-a2b2-31dd1638123a",
  wicadia: "3a44d401-6f83-40b2-8cdf-c764813abbd6",
  woxic: "46b85145-031f-4bb2-8f2f-15a4e2ad39a8",
  xantares: "db19b0d5-0ac2-43a9-99a3-a78613d9d385",
  heavygod: "5e18dd12-2e40-48c4-a66f-886108f095ed",
  "hunter-": "3751745b-d8ea-484d-8e97-12b5348ff345",
  matys: "30d8ebad-c584-44a6-a25d-2377eb29aea1",
  nertz: "d9e2a538-9722-4d1c-9925-958f849de1ea",
  sunpayus: "d682a62e-43f5-49be-b8c9-de923adcf564",
  boombl4: "498f0855-a1ab-4be3-b21d-3fc5d70fc441",
  d1ledez: "51f40bd6-d466-408e-8036-be7647e9c344",
  zorte: "965a1057-5c19-401f-89c5-748a0ded30d1",
};

export type TopTeam = {
  slug: string;
  name: string;
  rank: number;
  points: number;
  members: TrackedPlayer[];
};

export const rankingSnapshot = {
  date: "2026-07-06",
  label: "Valve 全球排名",
  source: "https://github.com/ValveSoftware/counter-strike_regional_standings/blob/main/live/2026/standings_global_2026_07_06.md",
};

function member(team: string, display: string, lookup = display, aliases: string[] = []): TrackedPlayer {
  return {
    lookup,
    faceitPlayerId: faceitPlayerIds[display.toLowerCase()] || null,
    display,
    team,
    role: "主力成员",
    country: "",
    focus: true,
    aliases,
  };
}

function team(slug: string, name: string, rank: number, points: number, players: Array<[string, string?, string[]?]>): TopTeam {
  return {
    slug,
    name,
    rank,
    points,
    members: players.map(([display, lookup, aliases]) => member(name, display, lookup || display, aliases)),
  };
}

// Valve's official global standings snapshot supplies the team order and five-player cores.
// FACEIT lookup names were verified against the official Data API on 2026-08-08.
export const topTeams: TopTeam[] = [
  team("spirit", "Spirit", 1, 1993, [
    ["donk", "donk666"], ["magixx", "lilpeepfan-", ["1xigam"]], ["sh1ro"], ["tN1R"], ["zont1x"],
  ]),
  team("falcons", "Falcons", 2, 1988, [
    ["karrigan"], ["kyousuke", "CEMEN_BAKIN"], ["m0NESY", "m0NESY", ["monesy"]], ["NiKo", "niko", ["nikola kovac", "nikola kovač"]], ["TeSeS", "teses"],
  ]),
  team("vitality", "Vitality", 3, 1908, [
    ["apEX"], ["flameZ", "flameZ-"], ["mezii", "mezii--"], ["ropz"], ["ZywOo", "ZywOo", ["zywoo"]],
  ]),
  team("natus-vincere", "Natus Vincere", 4, 1837, [
    ["Aleksib"], ["b1t"], ["iM", "-iM"], ["makazze"], ["w0nderful"],
  ]),
  team("furia", "FURIA", 5, 1797, [
    ["FalleN"], ["KSCERATO"], ["molodoy", "molodoy-"], ["YEKINDAR"], ["yuurih"],
  ]),
  team("mouz", "MOUZ", 6, 1762, [
    ["jL", "jL-"], ["Spinx"], ["torzsi"], ["xelex"], ["xertioN"],
  ]),
  team("legacy", "Legacy", 7, 1752, [
    ["arT"], ["dumau"], ["latto"], ["n1ssim"], ["saadzin", "saadzin_"],
  ]),
  team("aurora", "Aurora", 8, 1723, [
    ["MAJ3R", "Maj3r"], ["soulfly"], ["Wicadia"], ["woxic"], ["XANTARES"],
  ]),
  team("g2", "G2", 9, 1713, [
    ["HeavyGod"], ["huNter-", "hNt-", ["hunter", "nemanja kovac", "nemanja kovač"]], ["MATYS", "matys_-"], ["NertZ"], ["SunPayus"],
  ]),
  team("betboom", "BetBoom", 10, 1705, [
    ["Boombl4"], ["d1Ledez"], ["FL4MUS"], ["Magnojez"], ["zorte"],
  ]),
];

export const trackedPlayers = topTeams.flatMap(entry => entry.members);
export const focusPlayers = trackedPlayers;

export function findTopTeam(value: string | null | undefined) {
  if (!value) return topTeams[0];
  const normalized = value.toLowerCase();
  return topTeams.find(entry => entry.slug === normalized || entry.name.toLowerCase() === normalized) || topTeams[0];
}

export function findTrackedPlayer(nickname: string) {
  const normalized = nickname.toLowerCase();
  return trackedPlayers.find(player =>
    player.lookup.toLowerCase() === normalized ||
    player.display.toLowerCase() === normalized ||
    player.aliases.some(alias => alias.toLowerCase() === normalized)
  );
}
