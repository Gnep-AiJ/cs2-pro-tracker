import { trackedPlayers } from './tracked-players';

// Explicit identity joins, reviewed against the saved HLTV entrant records.
// Never join a public FACEIT search result to a professional by nickname alone.
const identities: Record<string, string> = {
  donk:'21167', magixx:'18317', sh1ro:'16920', tn1r:'19808', zont1x:'20423',
  karrigan:'429', kyousuke:'24177', m0nesy:'19230', niko:'3741', teses:'12018',
  apex:'7322', flamez:'16693', mezii:'18462', ropz:'11816', zywoo:'11893',
  aleksib:'9816', b1t:'18987', im:'14759', makazze:'22673', w0nderful:'20127',
};
export const proCohort = trackedPlayers.flatMap(p => {
  const hltv=identities[p.display.toLowerCase()];
  return hltv && p.faceitPlayerId ? [{id:p.faceitPlayerId,eventPlayerId:`hltv-${hltv}`,name:p.display,lookup:p.lookup,directoryTeam:p.team}] : [];
});
