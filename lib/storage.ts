import AsyncStorage from '@react-native-async-storage/async-storage';

import { AppState } from '@/lib/types';

const STORAGE_KEY = 'lastrep_state_v1';

const emptyState: AppState = {
  plans: [],
  activePlanId: undefined,
  exerciseMemory: {},
  workoutLogs: [],
  bodyweightLogs: [],
  restTimerEndsAt: undefined,
  restNotificationId: undefined,
  activeSession: undefined,
};

export async function loadState(): Promise<AppState> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return emptyState;
  }
  try {
    const parsed = JSON.parse(raw) as AppState;
    return {
      ...emptyState,
      ...parsed,
    };
  } catch {
    return emptyState;
  }
}

export async function saveState(state: AppState): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
