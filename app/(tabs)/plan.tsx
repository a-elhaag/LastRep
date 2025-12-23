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

import { AnimatedButton } from "@/components/ui/animated-button";
import { Colors } from "@/constants/theme";
import { getActivePlan, mergePlanIntoState, parsePlanJson } from "@/lib/plan";
import { useAppState } from "@/lib/store";

export default function PlanScreen() {
  const { state, setState } = useAppState();
  const [planInput, setPlanInput] = React.useState("");
  const activePlan = getActivePlan(state);

  const handleImport = () => {
    const { plan, error } = parsePlanJson(planInput);
    if (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => {}
      );
      Alert.alert("Invalid plan", error);
      return;
    }
    if (!plan) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => {}
      );
      Alert.alert("Invalid plan", "Plan is missing required fields.");
      return;
    }
    setState((prev) => mergePlanIntoState(prev, plan));
    setPlanInput("");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {}
    );
    Alert.alert("Plan imported", `${plan.name} is now active.`);
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Animated.Text entering={FadeIn} style={styles.title}>
        Plan
      </Animated.Text>

      <Animated.View entering={FadeInDown.delay(100)} style={styles.section}>
        <Text style={styles.sectionTitle}>Active plan</Text>
        {activePlan ? (
          <View style={styles.planSummary}>
            <Text style={styles.planName}>{activePlan.name}</Text>
            <View style={styles.metaRow}>
              <View style={styles.metaBadge}>
                <Text style={styles.metaBadgeText}>
                  {activePlan.restSeconds}s rest
                </Text>
              </View>
              <View style={styles.metaBadge}>
                <Text style={styles.metaBadgeText}>
                  {activePlan.weightStepKg}kg step
                </Text>
              </View>
              <View style={styles.metaBadge}>
                <Text style={styles.metaBadgeText}>
                  {activePlan.days.length} days
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <Text style={styles.helperText}>
            Import a JSON plan to begin tracking.
          </Text>
        )}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200)} style={styles.section}>
        <Text style={styles.sectionTitle}>Import JSON</Text>
        <Text style={styles.helperText}>
          Paste a workout plan JSON. Your progress data will be preserved when
          switching plans.
        </Text>
        <TextInput
          style={styles.input}
          multiline
          value={planInput}
          onChangeText={setPlanInput}
          placeholder="Paste plan JSON here..."
          placeholderTextColor={Colors.dark.muted}
          textAlignVertical="top"
        />
        <AnimatedButton
          title="Import Plan"
          variant="primary"
          onPress={handleImport}
          hapticStyle="medium"
          fullWidth
          disabled={!planInput.trim()}
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
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  sectionTitle: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: "700",
  },
  planSummary: {
    gap: 12,
  },
  planName: {
    color: Colors.dark.text,
    fontSize: 20,
    fontWeight: "700",
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metaBadge: {
    backgroundColor: Colors.dark.accent + "20",
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.dark.accent + "40",
  },
  metaBadgeText: {
    color: Colors.dark.tint,
    fontSize: 13,
    fontWeight: "600",
  },
  helperText: {
    color: Colors.dark.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  input: {
    minHeight: 180,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.dark.border,
    padding: 16,
    color: Colors.dark.text,
    fontSize: 14,
    backgroundColor: Colors.dark.background,
  },
});
