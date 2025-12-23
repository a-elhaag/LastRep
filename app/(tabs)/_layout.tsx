import { Tabs } from "expo-router";
import React from "react";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? "dark" : "light";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[theme].tint,
        tabBarInactiveTintColor: Colors.dark.muted,
        tabBarStyle: {
          backgroundColor: Colors.dark.card,
          borderTopColor: Colors.dark.border,
          borderTopWidth: 1,
          paddingTop: 8,
          height: 88,
        },
        headerStyle: {
          backgroundColor: Colors.dark.background,
        },
        headerTitleStyle: {
          color: Colors.dark.text,
          fontWeight: "800",
          fontSize: 18,
        },
        headerTintColor: Colors.dark.text,
        headerTitle: "LastRep",
        tabBarButton: HapticTab,
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Workout",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="dumbbell.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: "Progress",
          tabBarIcon: ({ color }) => (
            <IconSymbol
              size={26}
              name="chart.line.uptrend.xyaxis"
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: "Plan",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="doc.text.fill" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
