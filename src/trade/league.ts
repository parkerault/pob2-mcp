/**
 * The default league (D-20): `POE_LEAGUE` if set; else the first `/data/leagues` entry, in API
 * order, that isn't `Standard` or `Hardcore` and doesn't start with `HC `.
 */

export interface LeagueSource {
  getLeagues(): Promise<Array<{ id: string }>>;
}

export const NO_CURRENT_LEAGUE = 'no current league; set POE_LEAGUE';

/** Is this a temporary softcore trade league (the D-20 candidates)? */
export function isCurrentLeagueCandidate(id: string): boolean {
  return id !== 'Standard' && id !== 'Hardcore' && !id.startsWith('HC ');
}

/**
 * Resolve the default league. With `POE_LEAGUE` set (non-blank) it returns that without a request;
 * otherwise it reads the league list and throws `no current league; set POE_LEAGUE` when no entry
 * qualifies.
 */
export async function resolveDefaultLeague(
  env: Readonly<Record<string, string | undefined>>,
  source: LeagueSource,
): Promise<string> {
  const configured = env.POE_LEAGUE?.trim();
  if (configured) return configured;
  const leagues = await source.getLeagues();
  const current = leagues.find((l) => isCurrentLeagueCandidate(l.id));
  if (!current) throw new Error(NO_CURRENT_LEAGUE);
  return current.id;
}
