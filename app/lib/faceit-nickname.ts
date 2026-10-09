import { findTrackedPlayer } from '../data/tracked-players';
// Shared by search and profile lookup; verified aliases retain their immutable ID.
export function faceitNickname(value: string) {
  const name = value.trim();
  return findTrackedPlayer(name)?.lookup || name;
}
