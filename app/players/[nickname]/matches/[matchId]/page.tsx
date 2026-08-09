import MatchDetail from "../../../../components/MatchDetail";

export default async function MatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ nickname: string; matchId: string }>;
  searchParams: Promise<{ playerId?: string }>;
}) {
  const [{ nickname, matchId }, query] = await Promise.all([params, searchParams]);
  return <MatchDetail
    nickname={decodeURIComponent(nickname)}
    matchId={decodeURIComponent(matchId)}
    playerId={query.playerId || ""}
  />;
}
