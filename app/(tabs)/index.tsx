import * as Haptics from "expo-haptics";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, Layout } from "react-native-reanimated";

import { AnimatedPressable } from "@/components/ui/animated-pressable";
import { ExerciseCard } from "@/components/workout/ExerciseCard";
import { Colors } from "@/constants/theme";
import {
  formatSessionDuration,
  formatTime,
  initAudio,
  playCompletionSound,
  playStartSound,
} from "@/lib/notifications";
import { getActivePlan } from "@/lib/plan";
import { useAppState } from "@/lib/store";
import { ExercisePlan } from "@/lib/types";

export default function WorkoutScreen() {
  const { state, setState, hydrated } = useAppState();
  const plan = getActivePlan(state);
  const [activeDayId, setActiveDayId] = React.useState<string | undefined>(
    plan?.days[0]?.id
  );
  const [tick, setTick] = React.useState(0);

  // Initialize audio on mount
  React.useEffect(() => {
    initAudio();
  }, []);

  // Keep tick updating for timer display
  React.useEffect(() => {
    const interval = setInterval(() => setTick((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Sync active day with plan
  React.useEffect(() => {
    if (!plan) return;
    if (!activeDayId || !plan.days.find((day) => day.id === activeDayId)) {
      setActiveDayId(plan.days[0]?.id);
    }
  }, [plan?.id, activeDayId]);

  // Initialize exercise memory for rep options
  React.useEffect(() => {
    if (!plan || !activeDayId) return;
    const day = plan.days.find((item) => item.id === activeDayId);
    if (!day) return;

    let didUpdate = false;
    const nextMemory = { ...state.exerciseMemory };
    for (const exercise of day.exercises) {
      if (exercise.repOptions && exercise.repOptions.length > 0) {
        const existing = nextMemory[exercise.name];
        if (
          !existing ||
          !exercise.repOptions.includes(existing.lastRep ?? -1)
        ) {
          nextMemory[exercise.name] = {
            lastWeightKg: existing?.lastWeightKg ?? 0,
            lastRep: exercise.repOptions[0],
          };
          didUpdate = true;
        }
      }
    }
    if (didUpdate) {
      setState((prev) => ({ ...prev, exerciseMemory: nextMemory }));
    }
  }, [activeDayId, plan?.id]);

  // Handle rest timer completion with sound
  React.useEffect(() => {
    if (!state.restTimerEndsAt) return;
    const remaining = new Date(state.restTimerEndsAt).getTime() - Date.now();
    if (remaining <= 0) {
      setState((prev) => ({ ...prev, restTimerEndsAt: undefined }));
      // Play completion sound and haptic
      playCompletionSound();
    }
  }, [tick, state.restTimerEndsAt]);

  if (!hydrated) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!plan) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyTitle}>No Active Plan</Text>
        <Text style={styles.emptyText}>
          Go to Plan tab to import a workout plan
        </Text>
      </View>
    );
  }

  const activeDay =
    plan.days.find((day) => day.id === activeDayId) ?? plan.days[0];
  const today = new Date().toISOString().slice(0, 10);
  const isSessionActive = !!state.activeSession;

  const restRemaining = state.restTimerEndsAt
    ? Math.max(
        0,
        Math.ceil(
          (new Date(state.restTimerEndsAt).getTime() - Date.now()) / 1000
        )
      )
    : 0;

  const sessionDuration = state.activeSession
    ? formatSessionDuration(state.activeSession.startedAt)
    : "0:00";

  const updateMemory = (
    exerciseName: string,
    updates: { lastWeightKg?: number; lastRep?: number | "fail" }
  ) => {
    setState((prev) => ({
      ...prev,
      exerciseMemory: {
        ...prev.exerciseMemory,
        [exerciseName]: { ...prev.exerciseMemory[exerciseName], ...updates },
      },
    }));
  };

  const startSession = () => {
    setState((prev) => ({
      ...prev,
      activeSession: { startedAt: new Date().toISOString() },
    }));
    playStartSound();
  };

  const stopSession = () => {
    setState((prev) => ({
      ...prev,
      activeSession: undefined,
      restTimerEndsAt: undefined,
    }));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
      () => {}
    );
  };

  const handleSaveSet = (exerciseName: string) => {
    const exercise = activeDay.exercises.find(
      (item) => item.name === exerciseName
    );
    if (!exercise) return;

    const memory = state.exerciseMemory[exerciseName] ?? { lastWeightKg: 0 };
    let reps = memory.lastRep;
    if (exercise.repOptions && reps == null) {
      reps = exercise.repOptions[0];
      updateMemory(exerciseName, { lastRep: reps });
    }

    // Auto-start session if not active
    const now = new Date();
    const log = {
      id: `log_${now.getTime()}`,
      exerciseName,
      weightKg: memory.lastWeightKg,
      reps: exercise.repOptions ? reps : undefined,
      timeSeconds: exercise.timeSeconds,
      date: now.toISOString().slice(0, 10),
      createdAt: now.toISOString(),
    };

    setState((prev) => ({
      ...prev,
      activeSession: prev.activeSession ?? { startedAt: now.toISOString() },
      workoutLogs: [...prev.workoutLogs, log],
      restTimerEndsAt: new Date(
        now.getTime() + plan.restSeconds * 1000
      ).toISOString(),
    }));

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };

  // Show large START button when no session is active
  if (!isSessionActive) {
    return (
      <View style={styles.startContainer}>
        <Animated.Text entering={FadeIn.delay(100)} style={styles.appTitle}>
          LastRep
        </Animated.Text>
        <Animated.Text entering={FadeIn.delay(200)} style={styles.planName}>
          {plan.name}
        </Animated.Text>

        <Animated.View entering={FadeIn.delay(300)} style={styles.daySelector}>
          {plan.days.map((day) => (
            <AnimatedPressable
              key={day.id}
              onPress={() => setActiveDayId(day.id)}
              style={[
                styles.dayChip,
                day.id === activeDay.id && styles.dayChipActive,
              ]}
              hapticStyle="selection"
            >
              <Text
                style={[
                  styles.dayChipText,
                  day.id === activeDay.id && styles.dayChipTextActive,
                ]}
              >
                {day.title}
              </Text>
            </AnimatedPressable>
          ))}
        </Animated.View>

        <AnimatedPressable
          style={styles.startButton}
          onPress={startSession}
          scaleValue={0.95}
          hapticStyle="heavy"
        >
          <Text style={styles.startButtonText}>START</Text>
          <Text style={styles.startSubtext}>{activeDay.title}</Text>
        </AnimatedPressable>

        <Animated.Text entering={FadeIn.delay(500)} style={styles.hint}>
          Tap to begin your workout
        </Animated.Text>
      </View>
    );
  }

  // Active session view with timer
  return (
    <View style={styles.mainContainer}>
      {/* Sticky Timer Header */}
      <View style={styles.timerHeader}>
        <View style={styles.timerRow}>
          {restRemaining > 0 ? (
            <>
              <Text style={styles.timerLabel}>REST</Text>
              <Text style={styles.timerValue}>{formatTime(restRemaining)}</Text>
            </>
          ) : (
            <>
              <Text style={styles.timerLabelGo}>GO!</Text>
              <Text style={styles.timerValueReady}>Ready</Text>
            </>
          )}
        </View>
        <View style={styles.sessionInfo}>
          <Text style={styles.sessionDuration}>Session: {sessionDuration}</Text>
          <AnimatedPressable
            style={styles.stopButton}
            onPress={stopSession}
            hapticStyle="heavy"
          >
            <Text style={styles.stopButtonText}>END</Text>
          </AnimatedPressable>
        </View>
      </View>

      {/* Day selector */}
      <View style={styles.dayRow}>
        {plan.days.map((day) => (
          <AnimatedPressable
            key={day.id}
            onPress={() => {
              setActiveDayId(day.id);
              Haptics.selectionAsync().catch(() => {});
            }}
            style={[
              styles.dayButton,
              day.id === activeDay.id && styles.dayButtonActive,
            ]}
            haptic={false}
          >
            <Text
              style={[
                styles.dayText,
                day.id === activeDay.id && styles.dayTextActive,
              ]}
            >
              {day.id}
            </Text>
          </AnimatedPressable>
        ))}
      </View>

      {/* Exercise list */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.cardList}>
        {activeDay.exercises.map((exercise: ExercisePlan, index: number) => {
          const memory = state.exerciseMemory[exercise.name] ?? {
            lastWeightKg: 0,
          };
          const completedSets = state.workoutLogs.filter(
            (log) => log.date === today && log.exerciseName === exercise.name
          ).length;
          return (
            <Animated.View
              key={exercise.name}
              entering={FadeInDown.delay(index * 80).springify()}
              layout={Layout.springify()}
            >
              <ExerciseCard
                exercise={exercise}
                memory={memory}
                weightStepKg={plan.weightStepKg}
                completedSets={completedSets}
                onUpdateMemory={updateMemory}
                onSaveSet={handleSaveSet}
              />
            </Animated.View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  startContainer: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 16,
  },
  loadingText: {
    color: Colors.dark.text,
    fontSize: 16,
  },
  emptyTitle: {
    color: Colors.dark.text,
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 8,
  },
  emptyText: {
    color: Colors.dark.muted,
    textAlign: "center",
    fontSize: 16,
  },
  appTitle: {
    color: Colors.dark.text,
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: 2,
  },
  planName: {
    color: Colors.dark.muted,
    fontSize: 16,
    marginBottom: 24,
  },
  daySelector: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
    marginBottom: 40,
  },
  dayChip: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  dayChipActive: {
    backgroundColor: Colors.dark.tint,
    borderColor: Colors.dark.tint,
  },
  dayChipText: {
    color: Colors.dark.muted,
    fontSize: 14,
    fontWeight: "600",
  },
  dayChipTextActive: {
    color: Colors.dark.background,
    fontWeight: "700",
  },
  startButton: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: Colors.dark.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.dark.tint,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 40,
    elevation: 12,
  },
  startButtonText: {
    color: "#FFFFFF",
    fontSize: 38,
    fontWeight: "800",
    letterSpacing: 3,
  },
  startSubtext: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 6,
    opacity: 0.8,
  },
  hint: {
    color: Colors.dark.muted,
    fontSize: 14,
    marginTop: 24,
  },
  timerHeader: {
    backgroundColor: Colors.dark.card,
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  timerRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    gap: 14,
  },
  timerLabel: {
    color: Colors.dark.muted,
    fontSize: 18,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 3,
  },
  timerLabelGo: {
    color: Colors.dark.success,
    fontSize: 18,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 3,
  },
  timerValue: {
    color: Colors.dark.tint,
    fontSize: 60,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    letterSpacing: -2,
  },
  timerValueReady: {
    color: Colors.dark.success,
    fontSize: 60,
    fontWeight: "800",
  },
  sessionInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
  },
  sessionDuration: {
    color: Colors.dark.muted,
    fontSize: 14,
    fontWeight: "500",
  },
  stopButton: {
    backgroundColor: "#EF4444",
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 24,
  },
  stopButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 1,
  },
  dayRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: Colors.dark.background,
  },
  dayButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: Colors.dark.border,
    backgroundColor: "transparent",
  },
  dayButtonActive: {
    backgroundColor: Colors.dark.tint,
    borderColor: Colors.dark.tint,
  },
  dayText: {
    color: Colors.dark.text,
    fontSize: 13,
    fontWeight: "600",
  },
  dayTextActive: {
    color: Colors.dark.background,
    fontWeight: "700",
  },
  scroll: {
    flex: 1,
  },
  cardList: {
    padding: 20,
    gap: 18,
    paddingBottom: 50,
  },
});
