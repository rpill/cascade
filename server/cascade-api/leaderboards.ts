import { normalizeCloudSnapshot } from '../../src/cloud/CloudSnapshot.ts';
import { lifetimeMasteryPoints } from '../../src/leaderboards/LeaderboardConfig.ts';
import { getDailyStreaks } from '../../src/meta/DailyStreak.ts';
import { normalizeMetaSave } from '../../src/meta/MetaSave.ts';
import { HttpError, jsonResponse, readJsonBody } from './http.ts';
import type { BridgeClaims } from './session.ts';
import type { CascadeStore, StoredLeaderboardEntry, StoredLeaderboardPage } from './store.ts';
import { parseLeaderboardLimit, parseLeaderboardSubmitBody, validateBoardKey, validateDailyId } from './validation.ts';

const MASTERY_RANKS = ['novice', 'player', 'tactician', 'expert', 'master', 'grandmaster'] as const;

function masteryPublicEntry(entry: StoredLeaderboardEntry | null): StoredLeaderboardEntry | null {
  if (entry === null) return null;
  const ordinal = Number(entry.metric.masteryRank);
  const points = Number(entry.metric.masteryPoints);
  const rank = Number.isSafeInteger(ordinal) ? MASTERY_RANKS[ordinal - 1] : undefined;
  if (rank === undefined || !Number.isSafeInteger(points) || points < 0) return null;
  return { ...entry, metric: { rank, points } };
}

function masteryPublicPage(page: StoredLeaderboardPage): StoredLeaderboardPage {
  return {
    entries: page.entries.map(masteryPublicEntry).filter((entry): entry is StoredLeaderboardEntry => entry !== null),
    playerEntry: masteryPublicEntry(page.playerEntry),
  };
}

export async function handleLeaderboardRead(
  boardRaw: string,
  url: URL,
  claims: BridgeClaims | null,
  store: CascadeStore,
): Promise<Response> {
  const board = validateBoardKey(boardRaw);
  const limit = parseLeaderboardLimit(url.searchParams.get('limit'));
  const pikabuId = claims?.pikabuId;
  if (board === 'standard') return jsonResponse(await store.readStandard(limit, pikabuId));
  if (board === 'daily') {
    const dailyId = validateDailyId(url.searchParams.get('scope'));
    return jsonResponse(await store.readDaily(dailyId, limit, pikabuId));
  }
  if (board === 'daily-streak') return jsonResponse(await store.readDailyStreak(limit, pikabuId));
  return jsonResponse(masteryPublicPage(await store.readMastery(limit, pikabuId)));
}

function readStoredMeta(serialized: string | null) {
  if (serialized === null) return normalizeMetaSave(null);
  let raw: unknown;
  try { raw = JSON.parse(serialized) as unknown; }
  catch { throw new HttpError(502, 'Stored cloud profile is malformed.'); }
  const snapshot = normalizeCloudSnapshot(raw);
  if (snapshot === null) throw new HttpError(502, 'Stored cloud profile is malformed.');
  return snapshot.meta;
}

export async function handleLeaderboardSubmit(
  boardRaw: string,
  request: Request,
  claims: BridgeClaims | null,
  store: CascadeStore,
  now = new Date(),
): Promise<Response> {
  const board = validateBoardKey(boardRaw);
  if (claims === null) throw new HttpError(401, 'Verified authorized player is required.');

  let parsed: ReturnType<typeof parseLeaderboardSubmitBody>;
  try { parsed = parseLeaderboardSubmitBody(board, await readJsonBody(request), now.toISOString().slice(0, 10)); }
  catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, error instanceof Error ? error.message : 'Invalid leaderboard submission.');
  }

  if (parsed.kind === 'standard') {
    await store.submitStandard(claims.pikabuId, parsed.bestStreak, now.getTime());
    return jsonResponse({ status: 'published' });
  }
  if (parsed.kind === 'daily') {
    const status = await store.submitDaily(claims.pikabuId, {
      dailyId: parsed.dailyId,
      ...(parsed.attemptId === undefined ? {} : { attemptId: parsed.attemptId }),
      moves: parsed.moves,
      elapsedMs: parsed.elapsedMs,
      completedOnTime: parsed.completedOnTime,
      completedAt: now.getTime(),
    });
    return jsonResponse({ status });
  }
  if (parsed.kind === 'streak') {
    const profile = readStoredMeta(await store.readProfile(claims.pikabuId));
    const streak = getDailyStreaks(profile.daily.records, parsed.todayId);
    await store.submitDailyStreak(claims.pikabuId, streak.current, streak.best, now.getTime());
    return jsonResponse({ status: 'published', metric: streak });
  }
  const profile = normalizeMetaSave(parsed.profile);
  const masteryRank = MASTERY_RANKS.indexOf(profile.mastery.rank) + 1;
  const masteryPoints = lifetimeMasteryPoints(profile);
  await store.submitMastery(claims.pikabuId, masteryRank, masteryPoints, now.getTime());
  return jsonResponse({ status: 'published' });
}
