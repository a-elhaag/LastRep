import * as Haptics from "expo-haptics";
import React from "react";
import {
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Colors } from "@/constants/theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface AnimatedButtonProps extends Omit<PressableProps, "style"> {
  title: string;
  variant?: ButtonVariant;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  hapticStyle?: "light" | "medium" | "heavy";
  fullWidth?: boolean;
}

const springConfig = {
  damping: 15,
  stiffness: 400,
  mass: 0.5,
};

export function AnimatedButton({
  title,
  variant = "primary",
  style,
  textStyle,
  hapticStyle = "medium",
  fullWidth = false,
  onPress,
  onPressIn,
  onPressOut,
  disabled,
  ...props
}: AnimatedButtonProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = (e: any) => {
    scale.value = withSpring(0.96, springConfig);
    opacity.value = withTiming(0.9, { duration: 100 });

    const hapticMap = {
      light: Haptics.ImpactFeedbackStyle.Light,
      medium: Haptics.ImpactFeedbackStyle.Medium,
      heavy: Haptics.ImpactFeedbackStyle.Heavy,
    };

    Haptics.impactAsync(hapticMap[hapticStyle]).catch(() => undefined);
    onPressIn?.(e);
  };

  const handlePressOut = (e: any) => {
    scale.value = withSpring(1, springConfig);
    opacity.value = withTiming(1, { duration: 100 });
    onPressOut?.(e);
  };

  const variantStyles = getVariantStyles(variant, !!disabled);

  return (
    <AnimatedPressable
      style={[
        styles.button,
        variantStyles.button,
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
        animatedStyle,
        style,
      ]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      {...props}
    >
      <Text style={[styles.text, variantStyles.text, textStyle]}>{title}</Text>
    </AnimatedPressable>
  );
}

function getVariantStyles(variant: ButtonVariant, disabled: boolean) {
  const styles: Record<ButtonVariant, { button: ViewStyle; text: TextStyle }> =
    {
      primary: {
        button: {
          backgroundColor: disabled ? Colors.dark.muted : Colors.dark.accent,
        },
        text: {
          color: "#FFFFFF",
        },
      },
      secondary: {
        button: {
          backgroundColor: Colors.dark.card,
          borderWidth: 1,
          borderColor: Colors.dark.border,
        },
        text: {
          color: Colors.dark.text,
        },
      },
      ghost: {
        button: {
          backgroundColor: "transparent",
        },
        text: {
          color: Colors.dark.tint,
        },
      },
      danger: {
        button: {
          backgroundColor: "#EF4444",
        },
        text: {
          color: "#FFFFFF",
        },
      },
    };

  return styles[variant];
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  fullWidth: {
    width: "100%",
  },
  disabled: {
    opacity: 0.6,
  },
  text: {
    fontSize: 16,
    fontWeight: "700",
  },
});
