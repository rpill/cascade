export const DIFFICULTY_MODEL_VERSION = 1;

export const DIFFICULTY_WEIGHTS = Object.freeze({
  solverNodes: 0.30,
  rearrangementMoves: 0.25,
  freeCellTouches: 0.15,
  stockInterleaves: 0.15,
  decisionActions: 0.10,
  earlyProgressActions: 0.05,
});

const METRIC_KEYS = Object.freeze(Object.keys(DIFFICULTY_WEIGHTS));

function isAutomaticFoundation(action) {
  return action?.kind === 'to-foundation' && action.automatic === true;
}

function isDecision(action) {
  return !isAutomaticFoundation(action);
}

function isRearrangement(action) {
  return action?.kind === 'tableau-to-tableau'
    || action?.kind === 'waste-to-tableau'
    || action?.kind === 'free-to-tableau'
    || action?.kind === 'to-free';
}

function touchesFreeCell(action) {
  return action?.kind === 'to-free' || action?.kind === 'free-to-tableau';
}

export function measureProof(proof, initialStockCount) {
  if (!Array.isArray(proof)) throw new TypeError('proof must be an array');
  if (!Number.isInteger(initialStockCount) || initialStockCount < 0) {
    throw new RangeError(`initialStockCount must be a non-negative integer, got ${String(initialStockCount)}`);
  }

  let decisionActions = 0;
  let rearrangementMoves = 0;
  let freeCellTouches = 0;
  let stockInterleaves = 0;
  let earlyProgressActions = 0;
  let drawnCardCount = 0;
  let hasDrawn = false;
  let foundationPlacements = 0;
  let earlyProgressCaptured = false;

  for (const action of proof) {
    const decision = isDecision(action);

    if (action?.kind === 'draw') {
      hasDrawn = true;
      drawnCardCount += Array.isArray(action.cardIds) ? action.cardIds.length : 0;
    } else if (decision && hasDrawn && drawnCardCount < initialStockCount) {
      stockInterleaves += 1;
    }

    if (decision) decisionActions += 1;
    if (isRearrangement(action)) rearrangementMoves += 1;
    if (touchesFreeCell(action)) freeCellTouches += 1;

    if (action?.kind === 'to-foundation') {
      foundationPlacements += 1;
    }

    if (!earlyProgressCaptured) {
      if (decision) earlyProgressActions += 1;
      if (foundationPlacements >= 4) earlyProgressCaptured = true;
    }
  }

  // A malformed/incomplete proof with fewer than four foundation placements is
  // deliberately expensive rather than looking deceptively easy.
  if (!earlyProgressCaptured) earlyProgressActions = decisionActions;

  return {
    decisionActions,
    rearrangementMoves,
    freeCellTouches,
    stockInterleaves,
    earlyProgressActions,
  };
}

function averageRankPercentiles(values) {
  if (values.length === 0) return [];
  if (values.length === 1) return [0];

  const sorted = values
    .map((value, index) => ({ value, index }))
    .sort((left, right) => left.value - right.value || left.index - right.index);
  const result = new Array(values.length);

  for (let cursor = 0; cursor < sorted.length;) {
    let end = cursor + 1;
    while (end < sorted.length && Object.is(sorted[end].value, sorted[cursor].value)) end += 1;
    const averageRank = (cursor + (end - 1)) / 2;
    const percentile = (averageRank / (sorted.length - 1)) * 100;
    for (let index = cursor; index < end; index += 1) {
      result[sorted[index].index] = percentile;
    }
    cursor = end;
  }

  return result;
}

function requireFiniteNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new RangeError(`${label} must be a non-negative finite number`);
  return number;
}

export function scorePopulation(records) {
  if (!Array.isArray(records)) throw new TypeError('records must be an array');
  if (records.length === 0) return [];

  const enriched = records.map((record) => {
    const solverNodes = requireFiniteNumber(record.nodes ?? record.solverNodes, `seed ${String(record.seed)} solver nodes`);
    const metrics = measureProof(record.proof, record.initialStockCount);
    return {
      ...record,
      difficultyMetrics: metrics,
      difficultyInputs: {
        solverNodes: Math.log1p(solverNodes),
        ...metrics,
      },
    };
  });

  const percentileColumns = Object.fromEntries(METRIC_KEYS.map((key) => [
    key,
    averageRankPercentiles(enriched.map((record) => record.difficultyInputs[key])),
  ]));

  return enriched.map((record, index) => {
    const difficultyPercentiles = Object.fromEntries(
      METRIC_KEYS.map((key) => [key, percentileColumns[key][index]]),
    );
    const difficultyScore = METRIC_KEYS.reduce(
      (sum, key) => sum + difficultyPercentiles[key] * DIFFICULTY_WEIGHTS[key],
      0,
    );

    return {
      ...record,
      difficultyPercentiles,
      difficultyScore,
    };
  });
}

export function isOnboardingCandidate(record) {
  const p = record?.difficultyPercentiles;
  return Number(record?.difficultyScore) <= 20
    && Number(p?.freeCellTouches) <= 35
    && Number(p?.rearrangementMoves) <= 35
    && Number(p?.earlyProgressActions) <= 25;
}

export const STANDARD_QUOTAS = Object.freeze({
  onboarding: 5_000,
  easy: 15_000,
  medium: 17_500,
  hard: 12_500,
});

function quotaValue(quotas, key) {
  const value = quotas[key];
  if (!Number.isInteger(value) || value < 0) throw new RangeError(`Invalid ${key} quota: ${String(value)}`);
  return value;
}

export function partitionStandard(records, quotas = STANDARD_QUOTAS) {
  const required = {
    onboarding: quotaValue(quotas, 'onboarding'),
    easy: quotaValue(quotas, 'easy'),
    medium: quotaValue(quotas, 'medium'),
    hard: quotaValue(quotas, 'hard'),
  };

  const eligible = records.filter((record) => Number(record.difficultyScore) <= 95);
  const onboardingCandidates = eligible
    .filter(isOnboardingCandidate)
    .sort((left, right) => left.difficultyScore - right.difficultyScore || left.seed - right.seed);

  if (onboardingCandidates.length < required.onboarding) {
    throw new Error(`Cannot fill onboarding quota: need ${required.onboarding}, have ${onboardingCandidates.length}`);
  }

  const onboarding = onboardingCandidates.slice(0, required.onboarding);
  const onboardingSeeds = new Set(onboarding.map((record) => record.seed));
  const remaining = eligible
    .filter((record) => !onboardingSeeds.has(record.seed))
    .sort((left, right) => left.difficultyScore - right.difficultyScore || left.seed - right.seed);

  const remainingNeeded = required.easy + required.medium + required.hard;
  if (remaining.length < remainingNeeded) {
    throw new Error(`Cannot fill Standard quota: need ${remainingNeeded} non-onboarding deals, have ${remaining.length}`);
  }

  let cursor = 0;
  const take = (count) => {
    const slice = remaining.slice(cursor, cursor + count);
    cursor += count;
    return slice;
  };

  const partitions = {
    onboarding,
    easy: take(required.easy),
    medium: take(required.medium),
    hard: take(required.hard),
  };

  const allSeeds = Object.values(partitions).flat().map((record) => record.seed);
  if (new Set(allSeeds).size !== allSeeds.length) throw new Error('Standard partition contains duplicate seeds');
  return partitions;
}
