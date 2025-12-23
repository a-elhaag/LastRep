import { AppState, ExerciseMemory, ExercisePlan, Plan, PlanDay, RepOption } from '@/lib/types';

type PlanImport = {
  name: string;
  restSeconds?: number;
  weightStepKg: number;
  days: PlanDay[];
};

const DEFAULT_REST_SECONDS = 75;

function isRepOption(value: unknown): value is RepOption {
  return value === 'fail' || (typeof value === 'number' && Number.isFinite(value));
}

function normalizeExercise(raw: ExercisePlan): ExercisePlan | null {
  if (!raw?.name || typeof raw.name !== 'string') {
    return null;
  }
  const name = raw.name.trim();
  if (!name) {
    return null;
  }
  if (!Number.isFinite(raw.sets) || raw.sets <= 0) {
    return null;
  }
  const hasReps = Array.isArray(raw.repOptions) && raw.repOptions.length > 0;
  const hasTime = typeof raw.timeSeconds === 'number' && raw.timeSeconds > 0;
  if (!hasReps && !hasTime) {
    return null;
  }
  const repOptions = hasReps ? raw.repOptions?.filter(isRepOption) : undefined;
  if (hasReps && (!repOptions || repOptions.length === 0)) {
    return null;
  }
  return {
    name,
    sets: raw.sets,
    repOptions,
    timeSeconds: hasTime ? raw.timeSeconds : undefined,
  };
}

export function parsePlanJson(raw: string): { plan?: PlanImport; error?: string } {
  let parsed: PlanImport;
  try {
    parsed = JSON.parse(raw) as PlanImport;
  } catch {
    return { error: 'Plan JSON could not be parsed.' };
  }
  if (!parsed || typeof parsed !== 'object') {
    return { error: 'Plan JSON must be an object.' };
  }
  if (!parsed.name || typeof parsed.name !== 'string') {
    return { error: 'Plan name is required.' };
  }
  if (!Number.isFinite(parsed.weightStepKg) || parsed.weightStepKg <= 0) {
    return { error: 'weightStepKg is required and must be a number.' };
  }
  if (!Array.isArray(parsed.days) || parsed.days.length === 0) {
    return { error: 'Plan must include days.' };
  }
  const days: PlanDay[] = [];
  for (const day of parsed.days) {
    if (!day?.id || !day?.title || !Array.isArray(day.exercises)) {
      return { error: 'Each day must include id, title, and exercises.' };
    }
    const exercises: ExercisePlan[] = [];
    for (const exercise of day.exercises) {
      const normalized = normalizeExercise(exercise);
      if (!normalized) {
        return { error: `Exercise "${exercise?.name ?? 'unknown'}" is invalid.` };
      }
      exercises.push(normalized);
    }
    days.push({
      id: String(day.id),
      title: String(day.title),
      exercises,
    });
  }
  return {
    plan: {
      name: parsed.name,
      restSeconds:
        Number.isFinite(parsed.restSeconds) && (parsed.restSeconds as number) > 0
          ? parsed.restSeconds!
          : DEFAULT_REST_SECONDS,
      weightStepKg: parsed.weightStepKg,
      days,
    },
  };
}

export function mergePlanIntoState(state: AppState, plan: PlanImport): AppState {
  const now = new Date().toISOString();
  const newPlan: Plan = {
    ...plan,
    id: `plan_${Date.now()}`,
    createdAt: now,
    active: true,
  };

  const exerciseMemory: Record<string, ExerciseMemory> = { ...state.exerciseMemory };
  for (const day of newPlan.days) {
    for (const exercise of day.exercises) {
      if (!exerciseMemory[exercise.name]) {
        exerciseMemory[exercise.name] = {
          lastWeightKg: 0,
          lastRep: exercise.repOptions?.[0],
        };
      }
    }
  }

  const plans = state.plans.map((existing) => ({
    ...existing,
    active: false,
  }));
  plans.push(newPlan);

  return {
    ...state,
    plans,
    activePlanId: newPlan.id,
    exerciseMemory,
  };
}

export function getActivePlan(state: AppState): Plan | undefined {
  if (!state.activePlanId) {
    return state.plans.find((plan) => plan.active);
  }
  return state.plans.find((plan) => plan.id === state.activePlanId);
}
