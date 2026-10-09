import { NextResponse } from 'next/server';
import { getCatalogue, getProEvent } from '../../../lib/pro-event-feed';
export const runtime='edge';
export async function GET(request: Request) {
  const requested=new URL(request.url).searchParams.get('event');
  if(requested && !/^(?:ps-)?\d{1,8}$/.test(requested))return NextResponse.json({error:'invalid_event'},{status:400,headers:{'Cache-Control':'no-store'}});
  const list=requested?null:await getCatalogue();
  const now=Date.now();
  const id=requested || list?.events.find(e=>Date.parse(e.startsAt)<=now&&Date.parse(e.endsAt)>=now)?.id || list?.events.find(e=>Date.parse(e.startsAt)>now)?.id || list?.events.at(-1)?.id;
  if(!id)return NextResponse.json({error:'event_not_found'},{status:404,headers:{'Cache-Control':'no-store'}});
  const feed=await getProEvent(id);
  if(!feed)return NextResponse.json({error:'event_not_found'},{status:404,headers:{'Cache-Control':'no-store'}});
  return NextResponse.json(feed,{headers:{'Cache-Control':feed.details.saved||feed.saved?'no-store':'public, max-age=30, s-maxage=300'}});
}
