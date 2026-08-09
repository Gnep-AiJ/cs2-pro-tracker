import { Suspense } from "react";
import RankingsBoard from "../components/RankingsBoard";

export default function RankingsPage() {
  return <Suspense fallback={<div className="rank-page-fallback">正在读取 FACEIT 排行榜…</div>}><RankingsBoard /></Suspense>;
}
