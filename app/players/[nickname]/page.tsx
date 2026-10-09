import PlayerDetail from "../../components/CompactPlayerDetail";

export default async function PlayerPage({ params,searchParams }: { params: Promise<{ nickname: string }>;searchParams:Promise<{playerId?:string}> }) {
  const { nickname } = await params;
  const {playerId}=await searchParams;
  return <PlayerDetail nickname={nickname} playerId={playerId}/>;
}
