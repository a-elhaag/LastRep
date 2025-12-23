import React from "react";

import { loadState, saveState } from "@/lib/storage";
import { AppState } from "@/lib/types";

type AppStateContextValue = {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  hydrated: boolean;
};

const AppStateContext = React.createContext<AppStateContextValue | undefined>(
  undefined
);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<AppState>({
    plans: [],
    activePlanId: undefined,
    exerciseMemory: {},
    workoutLogs: [],
    bodyweightLogs: [],
    restTimerEndsAt: undefined,
    activeSession: undefined,
  });
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    loadState().then((loaded) => {
      if (mounted) {
        setState(loaded);
        setHydrated(true);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  React.useEffect(() => {
    if (!hydrated) {
      return;
    }
    saveState(state).catch(() => undefined);
  }, [state, hydrated]);

  return (
    <AppStateContext.Provider value={{ state, setState, hydrated }}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = React.useContext(AppStateContext);
  if (!context) {
    throw new Error("useAppState must be used within AppStateProvider");
  }
  return context;
}
