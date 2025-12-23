import * as Haptics from "expo-haptics";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { AnimatedPressable } from "@/components/ui/animated-pressable";
import { Colors } from "@/constants/theme";
import { ExerciseMemory, ExercisePlan, RepOption } from "@/lib/types";

type Props = {
  exercise: ExercisePlan;
  memory: ExerciseMemory;
  weightStepKg: number;
  completedSets: number;
  onUpdateMemory: (
    exerciseName: string,
    updates: Partial<ExerciseMemory>
  ) => void;
  onSaveSet: (exerciseName: string) => void;
};

function formatRepOption(option: RepOption) {
  return option === "fail" ? "Fail" : `${option}`;
}

export function ExerciseCard({
  exercise,
  memory,
  weightStepKg,
  completedSets,
  onUpdateMemory,
  onSaveSet,
}: Props) {
  const weight = Number.isFinite(memory.lastWeightKg) ? memory.lastWeightKg : 0;
  const selectedRep = memory.lastRep;
  const weightScale = useSharedValue(1);

  const weightAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: weightScale.value }],
  }));

  const adjustWeight = (delta: number) => {
    const next = Math.max(0, Number((weight + delta).toFixed(1)));
    weightScale.value = withSpring(1.05, { damping: 10, stiffness: 400 });
    setTimeout(() => {
      weightScale.value = withSpring(1, { damping: 15, stiffness: 400 });
    }, 100);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
      () => undefined
    );
    onUpdateMemory(exercise.name, { lastWeightKg: next });
  };

  const handleRepSelect = (option: RepOption) => {
    Haptics.selectionAsync().catch(() => undefined);
    onUpdateMemory(exercise.name, { lastRep: option });
  };

  const handleSaveSet = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => undefined
    );
    onSaveSet(exercise.name);
  };

  const progress = completedSets / exercise.sets;

  return (
    <View style={styles.card}>
      {/* Progress indicator */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <View style={styles.cardHeader}>
        <View style={styles.exerciseInfo}>
          <Text style={styles.exerciseName}>{exercise.name}</Text>
          <View style={styles.setsContainer}>
            {Array.from({ length: exercise.sets }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.setDot,
                  i < completedSets && styles.setDotCompleted,
                ]}
              />
            ))}
          </View>
        </View>
        <Text style={styles.setsText}>
          {completedSets}/{exercise.sets}
        </Text>
      </View>

      <View style={styles.weightRow}>
        <AnimatedPressable
          onPress={() => adjustWeight(-weightStepKg)}
          onLongPress={() => adjustWeight(-(weightStepKg * 2))}
          style={styles.weightButton}
          hapticStyle="light"
        >
          <Text style={styles.weightButtonText}>−</Text>
        </AnimatedPressable>

        <Animated.View style={[styles.weightValue, weightAnimatedStyle]}>
          <Text style={styles.weightText}>{weight.toFixed(1)}</Text>
          <Text style={styles.weightUnit}>kg</Text>
        </Animated.View>

        <AnimatedPressable
          onPress={() => adjustWeight(weightStepKg)}
          onLongPress={() => adjustWeight(weightStepKg * 2)}
          style={styles.weightButton}
          hapticStyle="light"
        >
          <Text style={styles.weightButtonText}>+</Text>
        </AnimatedPressable>
      </View>

      {exercise.repOptions ? (
        <View style={styles.repRow}>
          {exercise.repOptions.map((option) => {
            const isSelected = selectedRep === option;
            return (
              <AnimatedPressable
                key={`${exercise.name}-${option}`}
                onPress={() => handleRepSelect(option)}
                style={[styles.repButton, isSelected && styles.repButtonActive]}
                hapticStyle="selection"
              >
                <Text
                  style={[styles.repText, isSelected && styles.repTextActive]}
                >
                  {formatRepOption(option)}
                </Text>
              </AnimatedPressable>
            );
          })}
        </View>
      ) : (
        <View style={styles.timeBadge}>
          <Text style={styles.timeText}>{exercise.timeSeconds}s</Text>
        </View>
      )}

      <AnimatedPressable
        style={styles.saveButton}
        onPress={handleSaveSet}
        hapticStyle="medium"
        scaleValue={0.97}
      >
        <Text style={styles.saveText}>Save Set</Text>
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.dark.card,
    borderRadius: 20,
    padding: 18,
    gap: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    overflow: "hidden",
  },
  progressBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: Colors.dark.border,
  },
  progressFill: {
    height: "100%",
    backgroundColor: Colors.dark.tint,
    borderRadius: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingTop: 4,
  },
  exerciseInfo: {
    flex: 1,
    gap: 8,
  },
  exerciseName: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  setsContainer: {
    flexDirection: "row",
    gap: 6,
  },
  setDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.dark.border,
  },
  setDotCompleted: {
    backgroundColor: Colors.dark.success,
  },
  setsText: {
    color: Colors.dark.muted,
    fontSize: 14,
    fontWeight: "600",
  },
  weightRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  weightButton: {
    backgroundColor: Colors.dark.accent,
    borderRadius: 14,
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  weightButtonText: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "600",
  },
  weightValue: {
    alignItems: "center",
    minWidth: 120,
  },
  weightText: {
    color: Colors.dark.text,
    fontSize: 40,
    fontWeight: "800",
    letterSpacing: -1,
  },
  weightUnit: {
    color: Colors.dark.muted,
    fontSize: 13,
    fontWeight: "500",
    marginTop: 2,
  },
  repRow: {
    flexDirection: "row",
    gap: 10,
  },
  repButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.dark.border,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "transparent",
  },
  repButtonActive: {
    backgroundColor: Colors.dark.tint,
    borderColor: Colors.dark.tint,
  },
  repText: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: "600",
  },
  repTextActive: {
    color: "#0A0A0F",
    fontWeight: "700",
  },
  timeBadge: {
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: Colors.dark.accent + "20",
    borderWidth: 1,
    borderColor: Colors.dark.accent + "40",
  },
  timeText: {
    color: Colors.dark.tint,
    fontWeight: "700",
    fontSize: 14,
  },
  saveButton: {
    backgroundColor: Colors.dark.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
    letterSpacing: 0.2,
  },
});
