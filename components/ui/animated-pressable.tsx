import * as Haptics from "expo-haptics";
import React from "react";
import { Pressable, PressableProps, StyleProp, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

const ReanimatedPressable = Animated.createAnimatedComponent(Pressable);

interface AnimatedPressableProps extends Omit<PressableProps, "style"> {
  style?: StyleProp<ViewStyle>;
  scaleValue?: number;
  haptic?: boolean;
  hapticStyle?: "light" | "medium" | "heavy" | "selection";
}

const springConfig = {
  damping: 15,
  stiffness: 400,
  mass: 0.5,
};

export function AnimatedPressable({
  style,
  scaleValue = 0.96,
  haptic = true,
  hapticStyle = "light",
  onPressIn,
  onPressOut,
  children,
  ...props
}: AnimatedPressableProps & { children?: React.ReactNode }) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = (e: any) => {
    scale.value = withSpring(scaleValue, springConfig);

    if (haptic) {
      if (hapticStyle === "selection") {
        Haptics.selectionAsync().catch(() => undefined);
      } else {
        const hapticMap = {
          light: Haptics.ImpactFeedbackStyle.Light,
          medium: Haptics.ImpactFeedbackStyle.Medium,
          heavy: Haptics.ImpactFeedbackStyle.Heavy,
        };
        Haptics.impactAsync(hapticMap[hapticStyle]).catch(() => undefined);
      }
    }

    onPressIn?.(e);
  };

  const handlePressOut = (e: any) => {
    scale.value = withSpring(1, springConfig);
    onPressOut?.(e);
  };

  return (
    <ReanimatedPressable
      style={[animatedStyle, style]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      {...props}
    >
      {children}
    </ReanimatedPressable>
  );
}
