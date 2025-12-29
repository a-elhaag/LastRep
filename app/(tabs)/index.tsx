import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, Layout } from "react-native-reanimated";

import { AnimatedPressable } from "@/components/ui/animated-pressable";
import { ExerciseCard } from "@/components/workout/ExerciseCard";
import { Colors } from "@/constants/theme";
import {
  cancelScheduledNotification,
  ensureNotificationPermissions,
  formatSessionDuration,
  formatTime,
  initAudio,
  playCompletionSound,
  playStartSound,
  primeNotifications,
  scheduleRestNotification,
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
  const [notificationsReady, setNotificationsReady] = React.useState(false);

  // Initialize audio on mount
  React.useEffect(() => {
    initAudio();
  }, []);

  // Prime notification permissions and categories early
  React.useEffect(() => {
    primeNotifications()
      .then((allowed) => setNotificationsReady(allowed))
      .catch(() => setNotificationsReady(false));
  }, []);

  // Cleanup: cancel any scheduled notifications when the workout screen unmounts
  React.useEffect(() => {
    return () => {
      Notifications.cancelAllScheduledNotificationsAsync().catch(() => {
        // Ignore cleanup errors
      });
    };
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
  }, [plan, activeDayId]);

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
  }, [activeDayId, plan, setState, state.exerciseMemory]);

  // Handle rest timer completion with sound
  React.useEffect(() => {
    if (!state.restTimerEndsAt) return;
    const remaining = new Date(state.restTimerEndsAt).getTime() - Date.now();
    if (remaining <= 0) {
      setState((prev) => ({ ...prev, restTimerEndsAt: undefined }));
      // Play completion sound and haptic
      playCompletionSound();
    }
  }, [setState, state.restTimerEndsAt, tick]);

  // Cancel scheduled reminders when rest timer clears
  React.useEffect(() => {
    if (!state.restTimerEndsAt) {
      // Cancel any scheduled rest reminder notification when the timer is cleared
      cancelScheduledNotification("rest-timer");
    }
  }, [state.restTimerEndsAt]);

  // Handle notification actions for logging and snoozing
  React.useEffect(() => {
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        handleNotificationResponse(response);
      }
    });
    const sub = Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse
    );
    return () => {
      sub.remove();
    };
  }, [handleNotificationResponse]);

  const activeDay =
    plan?.days.find((day) => day.id === activeDayId) ?? plan?.days[0];
  const today = new Date().toISOString().slice(0, 10);
  const isSessionActive = !!state.activeSession;

  const findExerciseByName = React.useCallback(
    (exerciseName: string) => {
      if (!plan) return undefined;
      return plan.days
        .flatMap((day) => day.exercises)
        .find((exercise) => exercise.name === exerciseName);
    },
    [plan]
  );

  const scheduleRestReminder = React.useCallback(
    async (exerciseName: string, restSeconds: number) => {
      if (restSeconds <= 0 || !exerciseName) return;
      await cancelScheduledNotification(state.restNotificationId);
      const id = await scheduleRestNotification({
        exerciseName,
        restSeconds,
        planName: plan?.name,
      });
      if (id) {
        setNotificationsReady(true);
      }
      setState((prev) => ({ ...prev, restNotificationId: id }));
    },
    [plan?.name, setState, state.restNotificationId]
  );

  const cancelRestReminder = React.useCallback(async () => {
    if (!state.restNotificationId) return;
    await cancelScheduledNotification(state.restNotificationId);
    setState((prev) => ({ ...prev, restNotificationId: undefined }));
  }, [setState, state.restNotificationId]);

  const logSet = React.useCallback(
    (exerciseName: string, source: "ui" | "notification" = "ui") => {
      if (!plan) return;
      const exercise = findExerciseByName(exerciseName);
      if (!exercise) return;

      const now = new Date();
      const nowIso = now.toISOString();

      setState((prev) => {
        const memory = prev.exerciseMemory[exerciseName] ?? {
          lastWeightKg: 0,
          lastRep: exercise.repOptions?.[0],
        };
        const reps = exercise.repOptions
          ? memory.lastRep ?? exercise.repOptions[0]
          : undefined;
        const restEndsAt = new Date(
          now.getTime() + plan.restSeconds * 1000
        ).toISOString();

        return {
          ...prev,
          activeSession: prev.activeSession ?? { startedAt: nowIso },
          exerciseMemory: {
            ...prev.exerciseMemory,
            [exerciseName]: {
              lastWeightKg: memory.lastWeightKg ?? 0,
              lastRep: reps,
            },
          },
          workoutLogs: [
            ...prev.workoutLogs,
            {
              id: `log_${now.getTime()}`,
              exerciseName,
              weightKg: memory.lastWeightKg ?? 0,
              reps: exercise.repOptions ? reps : undefined,
              timeSeconds: exercise.timeSeconds,
              date: nowIso.slice(0, 10),
              createdAt: nowIso,
            },
          ],
          restTimerEndsAt: restEndsAt,
        };
      });

      scheduleRestReminder(exerciseName, plan.restSeconds);

      if (source === "ui") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
          () => {}
        );
      }
    },
    [findExerciseByName, plan, scheduleRestReminder, setState]
  );

  const handleNotificationResponse = React.useCallback(
    (response: Notifications.NotificationResponse) => {
      const data =
        response.notification.request.content
          .data as Record<string, unknown>;
      const type =
        typeof data?.type === "string" ? (data.type as string) : undefined;
      const exerciseName =
        typeof data?.exerciseName === "string" ? data.exerciseName : undefined;
      if (type !== "rest-reminder" || !exerciseName) {
        return;
      }

      if (
        response.actionIdentifier ===
          Notifications.DEFAULT_ACTION_IDENTIFIER ||
        response.actionIdentifier === "log_set"
      ) {
        logSet(exerciseName, "notification");
        return;
      }

      if (response.actionIdentifier === "snooze_rest") {
        const parsed =
          typeof data?.snoozeSeconds === "number"
            ? data.snoozeSeconds
            : Number(data?.snoozeSeconds ?? 120);
        const snoozeSeconds =
          Number.isFinite(parsed) && parsed > 0 ? parsed : 120;
        const snoozeEndsAt = new Date(
          Date.now() + snoozeSeconds * 1000
        ).toISOString();
        setState((prev) => ({
          ...prev,
          restTimerEndsAt: snoozeEndsAt,
        }));
        scheduleRestReminder(exerciseName, snoozeSeconds);
      }
    },
    [logSet, scheduleRestReminder, setState]
  );

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

  if (!hydrated) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!plan || !activeDay) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyTitle}>No Active Plan</Text>
        <Text style={styles.emptyText}>
          Go to Plan tab to import a workout plan
        </Text>
      </View>
    );
  }

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
    cancelRestReminder();
    setState((prev) => ({
      ...prev,
      activeSession: undefined,
      restTimerEndsAt: undefined,
      restNotificationId: undefined,
    }));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
      () => {}
    );
  };

  const handleSaveSet = (exerciseName: string) => {
    logSet(exerciseName, "ui");
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

      <Animated.View
        entering={FadeInDown.delay(120)}
        style={styles.notificationCard}
      >
        <View style={styles.notificationHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.notificationTitle}>Notification Center</Text>
            <Text style={styles.notificationSubtitle}>
              Timer-driven reminders with inline actions keep you logging from
              the shade.
            </Text>
          </View>
          <View
            style={[
              styles.statusPill,
              notificationsReady
                ? styles.statusPillReady
                : styles.statusPillPending,
            ]}
          >
            <Text
              style={[
                styles.statusPillText,
                notificationsReady
                  ? styles.statusPillTextReady
                  : styles.statusPillTextPending,
              ]}
            >
              {notificationsReady ? "Primed" : "Enable"}
            </Text>
          </View>
        </View>

        <View style={styles.notificationActions}>
          <AnimatedPressable
            style={[styles.notificationButton, styles.notificationButtonPrimary]}
            onPress={() =>
              ensureNotificationPermissions()
                .then((allowed) => setNotificationsReady(allowed))
                .catch(() => setNotificationsReady(false))
            }
            hapticStyle="light"
            scaleValue={0.97}
          >
            <Text style={styles.notificationButtonTextPrimary}>
              {notificationsReady ? "Refresh access" : "Enable alerts"}
            </Text>
          </AnimatedPressable>

          <AnimatedPressable
            style={[styles.notificationButton, styles.notificationButtonGhost]}
            disabled={!activeDay?.exercises?.length}
            onPress={() => {
              // Find the most recently logged exercise from today's workout
              const exerciseNames = new Set(activeDay.exercises.map(ex => ex.name));
              const todaysLogs = state.workoutLogs.filter((log) => 
                log.date === today && exerciseNames.has(log.exerciseName)
              );
              
              // Find the most recent log by comparing createdAt timestamps
              const mostRecentLog = todaysLogs.reduce((latest, log) => 
                !latest || log.createdAt > latest.createdAt ? log : latest
              , null as typeof todaysLogs[0] | null);
              
              const exerciseName = mostRecentLog?.exerciseName || activeDay.exercises[0]?.name;
              
              if (!exerciseName) return;
              scheduleRestReminder(
                exerciseName,
                restRemaining > 1 ? restRemaining : 5
              );
            }}
            hapticStyle="selection"
            scaleValue={0.97}
          >
            <Text style={styles.notificationButtonGhostText}>
              Ping next set
            </Text>
          </AnimatedPressable>
        </View>

        <View style={styles.notificationMetaRow}>
          <Text style={styles.notificationMeta}>
            Actions: Log set · Snooze 2m · Deep link to training.
          </Text>
          <Text style={styles.notificationMeta}>
            Timer syncs when you snooze or pause.
          </Text>
        </View>
      </Animated.View>

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
  notificationCard: {
    marginHorizontal: 20,
    marginVertical: 14,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.card,
    gap: 12,
    shadowColor: Colors.dark.tint,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  notificationHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  notificationTitle: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: "700",
  },
  notificationSubtitle: {
    color: Colors.dark.muted,
    fontSize: 13,
    marginTop: 4,
  },
  notificationActions: {
    flexDirection: "row",
    gap: 10,
  },
  notificationButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.background,
  },
  notificationButtonPrimary: {
    backgroundColor: Colors.dark.tint,
    borderColor: Colors.dark.tint,
  },
  notificationButtonGhost: {
    backgroundColor: Colors.dark.card,
  },
  notificationButtonTextPrimary: {
    color: Colors.dark.background,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  notificationButtonGhostText: {
    color: Colors.dark.text,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  notificationMetaRow: {
    gap: 4,
  },
  notificationMeta: {
    color: Colors.dark.muted,
    fontSize: 12,
  },
  statusPill: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  statusPillReady: {
    backgroundColor: Colors.dark.success + "20",
    borderColor: Colors.dark.success,
  },
  statusPillPending: {
    backgroundColor: Colors.dark.accent + "15",
    borderColor: Colors.dark.accent,
  },
  statusPillText: {
    fontWeight: "700",
    fontSize: 12,
  },
  statusPillTextReady: {
    color: Colors.dark.success,
  },
  statusPillTextPending: {
    color: Colors.dark.accent,
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
