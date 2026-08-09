import PlayerDetail from "../../components/PlayerDetail";

export default async function PlayerPage({ params }: { params: Promise<{ nickname: string }> }) {
  const { nickname } = await params;
  return <PlayerDetail nickname={decodeURIComponent(nickname)} />;
}
