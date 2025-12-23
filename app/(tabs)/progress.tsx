import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { VictoryAxis, VictoryChart, VictoryLine } from "victory-native";

import { AnimatedButton } from "@/components/ui/animated-button";
import { Colors } from "@/constants/theme";
import { getActivePlan } from "@/lib/plan";
import { useAppState } from "@/lib/store";
import { WorkoutLog } from "@/lib/types";

type SeriesPoint = { x: number; y: number };

function formatDateShort(value: number) {
  const date = new Date(value);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function buildBestSetSeries(logs: WorkoutLog[]) {
  const bestByExercise = new Map<string, Map<string, WorkoutLog>>();
  for (const log of logs) {
    const exerciseMap =
      bestByExercise.get(log.exerciseName) ?? new Map<string, WorkoutLog>();
    const existing = exerciseMap.get(log.date);
    if (!existing || log.weightKg > existing.weightKg) {
      exerciseMap.set(log.date, log);
    }
    bestByExercise.set(log.exerciseName, exerciseMap);
  }

  const series: Record<string, SeriesPoint[]> = {};
  for (const [exerciseName, dateMap] of bestByExercise) {
    const points: SeriesPoint[] = Array.from(dateMap.values())
      .map((log) => ({
        x: new Date(log.date).getTime(),
        y: log.weightKg,
      }))
      .sort((a, b) => a.x - b.x);
    series[exerciseName] = points;
  }
  return series;
}

function getBodyweightSeries(entries: { date: string; kg: number }[]) {
  return entries
    .map((entry) => ({
      x: new Date(entry.date).getTime(),
      y: entry.kg,
    }))
    .sort((a, b) => a.x - b.x);
}

function buildRecentCalendar(logs: WorkoutLog[], days = 14) {
  const today = new Date();
  const map = new Map<string, number>();
  for (const log of logs) {
    map.set(log.date, (map.get(log.date) ?? 0) + 1);
  }
  const items: { label: string; date: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    const iso = date.toISOString().slice(0, 10);
    const label = `${date.getMonth() + 1}/${date.getDate()}`;
    items.push({ label, date: iso, count: map.get(iso) ?? 0 });
  }
  return items;
}

export default function ProgressScreen() {
  const { state, setState } = useAppState();
  const plan = getActivePlan(state);
  const [bodyweightInput, setBodyweightInput] = React.useState("");

  const bodyweightSeries = React.useMemo(
    () => getBodyweightSeries(state.bodyweightLogs),
    [state.bodyweightLogs]
  );
  const strengthSeries = React.useMemo(
    () => buildBestSetSeries(state.workoutLogs),
    [state.workoutLogs]
  );
  const calendar = React.useMemo(
    () => buildRecentCalendar(state.workoutLogs),
    [state.workoutLogs]
  );

  const saveBodyweight = () => {
    const value = Number.parseFloat(bodyweightInput);
    if (!Number.isFinite(value)) {
      Alert.alert("Enter a valid bodyweight.");
      return;
    }
    const date = new Date().toISOString().slice(0, 10);
    setState((prev) => {
      const updated = prev.bodyweightLogs.filter(
        (entry) => entry.date !== date
      );
      updated.push({ date, kg: value });
      return {
        ...prev,
        bodyweightLogs: updated,
      };
    });
    setBodyweightInput("");
  };

  const copyProgressPrompt = async () => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recentBodyweight = state.bodyweightLogs
      .filter((entry) => new Date(entry.date).getTime() >= thirtyDaysAgo)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const bodyweightLine =
      recentBodyweight.length >= 2
        ? `Bodyweight: ${recentBodyweight[0].kg} -> ${
            recentBodyweight[recentBodyweight.length - 1].kg
          } kg`
        : "Bodyweight: not enough data";

    const strengthLines = Object.entries(strengthSeries)
      .map(([exercise, points]) => {
        if (points.length === 0) {
          return `${exercise}: no data`;
        }
        const first = points[0].y;
        const last = points[points.length - 1].y;
        return `${exercise}: ${first} -> ${last} kg`;
      })
      .join("\n");

    const exportPlan = plan
      ? JSON.stringify(
          {
            name: plan.name,
            restSeconds: plan.restSeconds,
            weightStepKg: plan.weightStepKg,
            days: plan.days,
          },
          null,
          2
        )
      : "No active plan.";

    const prompt = [
      "Here is my last 30 days of training data:",
      "",
      bodyweightLine,
      "Strength progress (start -> latest):",
      strengthLines || "Not enough data",
      "",
      "Current plan:",
      exportPlan,
      "",
      "Rules for the new plan:",
      "- Keep exercise names the same when possible so progress sticks",
      "- Keep weightStepKg at 2.5 unless there is a compelling reason to change",
      "- Preserve restSeconds if it fits; adjust only with justification",
      "- Respond only with JSON in the same format as above",
      "",
      "Optimize my next plan without losing progress.",
    ].join("\n");

    await Clipboard.setStringAsync(prompt);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {}
    );
    Alert.alert("Copied", "Progress prompt copied to clipboard.");
  };

  const handleSaveBodyweight = () => {
    saveBodyweight();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Animated.Text entering={FadeIn} style={styles.title}>
        Progress
      </Animated.Text>

      <Animated.View entering={FadeInDown.delay(100)} style={styles.section}>
        <Text style={styles.sectionTitle}>Bodyweight</Text>
        <View style={styles.inputRow}>
          <TextInput
            placeholder="72.5"
            placeholderTextColor={Colors.dark.muted}
            value={bodyweightInput}
            onChangeText={setBodyweightInput}
            keyboardType="decimal-pad"
            style={styles.input}
          />
          <AnimatedButton
            title="Save"
            variant="primary"
            onPress={handleSaveBodyweight}
            hapticStyle="medium"
          />
        </View>
        {bodyweightSeries.length > 1 ? (
          <VictoryChart
            height={220}
            padding={{ top: 20, bottom: 40, left: 50, right: 20 }}
            domainPadding={{ y: 10 }}
          >
            <VictoryAxis
              tickFormat={formatDateShort}
              style={{
                tickLabels: { fill: Colors.dark.muted, fontSize: 10 },
                axis: { stroke: Colors.dark.border },
                grid: { stroke: Colors.dark.card },
              }}
            />
            <VictoryAxis
              dependentAxis
              style={{
                tickLabels: { fill: Colors.dark.muted, fontSize: 10 },
                axis: { stroke: Colors.dark.border },
                grid: { stroke: Colors.dark.card },
              }}
            />
            <VictoryLine
              data={bodyweightSeries}
              style={{
                data: { stroke: Colors.dark.tint, strokeWidth: 3 },
              }}
            />
          </VictoryChart>
        ) : (
          <Text style={styles.helperText}>
            Log at least two entries to see the chart.
          </Text>
        )}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200)} style={styles.section}>
        <Text style={styles.sectionTitle}>Strength</Text>
        {Object.keys(strengthSeries).length === 0 && (
          <Text style={styles.helperText}>
            Log sets to unlock strength trends.
          </Text>
        )}
        {Object.entries(strengthSeries).map(([exercise, points]) => (
          <View key={exercise} style={styles.chartCard}>
            <Text style={styles.chartTitle}>{exercise}</Text>
            {points.length > 1 ? (
              <VictoryChart
                height={180}
                padding={{ top: 20, bottom: 40, left: 50, right: 20 }}
                domainPadding={{ y: 10 }}
              >
                <VictoryAxis
                  tickFormat={formatDateShort}
                  style={{
                    tickLabels: { fill: Colors.dark.muted, fontSize: 10 },
                    axis: { stroke: Colors.dark.border },
                    grid: { stroke: Colors.dark.card },
                  }}
                />
                <VictoryAxis
                  dependentAxis
                  style={{
                    tickLabels: { fill: Colors.dark.muted, fontSize: 10 },
                    axis: { stroke: Colors.dark.border },
                    grid: { stroke: Colors.dark.card },
                  }}
                />
                <VictoryLine
                  data={points}
                  style={{
                    data: { stroke: Colors.dark.success, strokeWidth: 3 },
                  }}
                />
              </VictoryChart>
            ) : (
              <Text style={styles.helperText}>Need at least two workouts.</Text>
            )}
          </View>
        ))}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(300)} style={styles.section}>
        <Text style={styles.sectionTitle}>
          Training calendar (last 14 days)
        </Text>
        <View style={styles.calendarRow}>
          {calendar.map((day) => {
            const active = day.count > 0;
            return (
              <View
                key={day.date}
                style={[
                  styles.calendarCell,
                  active && styles.calendarCellActive,
                ]}
              >
                <Text
                  style={[
                    styles.calendarLabel,
                    active && styles.calendarLabelActive,
                  ]}
                >
                  {day.label}
                </Text>
                <Text
                  style={[
                    styles.calendarCount,
                    active && styles.calendarCountActive,
                  ]}
                >
                  {active
                    ? `${day.count} set${day.count > 1 ? "s" : ""}`
                    : "Rest"}
                </Text>
              </View>
            );
          })}
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(400)}>
        <AnimatedButton
          title="Copy Progress Prompt"
          variant="secondary"
          onPress={copyProgressPrompt}
          hapticStyle="light"
          fullWidth
        />
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 24,
    backgroundColor: Colors.dark.background,
    paddingBottom: 50,
  },
  scroll: {
    backgroundColor: Colors.dark.background,
  },
  title: {
    color: Colors.dark.text,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  section: {
    backgroundColor: Colors.dark.card,
    borderRadius: 20,
    padding: 18,
    gap: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  sectionTitle: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: "700",
  },
  inputRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  input: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.dark.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: Colors.dark.text,
    fontSize: 16,
    backgroundColor: Colors.dark.background,
  },
  helperText: {
    color: Colors.dark.muted,
    fontSize: 13,
  },
  chartCard: {
    backgroundColor: Colors.dark.background,
    borderRadius: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  chartTitle: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: "600",
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  calendarRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  calendarCell: {
    width: "30%",
    backgroundColor: Colors.dark.background,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  calendarCellActive: {
    borderColor: Colors.dark.accent,
    backgroundColor: Colors.dark.accent + "15",
  },
  calendarLabel: {
    color: Colors.dark.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  calendarLabelActive: {
    color: Colors.dark.text,
  },
  calendarCount: {
    color: Colors.dark.muted,
    fontSize: 12,
    marginTop: 2,
  },
  calendarCountActive: {
    color: Colors.dark.tint,
    fontWeight: "700",
  },
});
