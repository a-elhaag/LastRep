export type RepOption = number | "fail";

export type ExercisePlan = {
  name: string;
  sets: number;
  repOptions?: RepOption[];
  timeSeconds?: number;
};

export type PlanDay = {
  id: string;
  title: string;
  exercises: ExercisePlan[];
};

export type Plan = {
  id: string;
  name: string;
  restSeconds: number;
  weightStepKg: number;
  days: PlanDay[];
  createdAt: string;
  active: boolean;
};

export type ExerciseMemory = {
  lastWeightKg: number;
  lastRep?: RepOption;
};

export type WorkoutLog = {
  id: string;
  exerciseName: string;
  weightKg: number;
  reps?: number | "fail";
  timeSeconds?: number;
  date: string;
  createdAt: string;
};

export type BodyweightLog = {
  date: string;
  kg: number;
};

export type ActiveSession = {
  startedAt: string;
};

export type AppState = {
  plans: Plan[];
  activePlanId?: string;
  exerciseMemory: Record<string, ExerciseMemory>;
  workoutLogs: WorkoutLog[];
  bodyweightLogs: BodyweightLog[];
  restTimerEndsAt?: string;
  restNotificationId?: string;
  activeSession?: ActiveSession;
};
