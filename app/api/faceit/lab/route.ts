import snapshot from '../../../data/pro-lab-snapshot.json';
export const runtime='edge';
export async function GET() {
  return Response.json({...snapshot,storage:'snapshot',stale:Date.now()-Date.parse(snapshot.observedAt)>12*3600000},{headers:{'Cache-Control':'public, max-age=60, s-maxage=300'}});
}
