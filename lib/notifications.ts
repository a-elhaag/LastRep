// Timer utilities with audio notifications + native notification hooks
// Works in Expo Go without issues

import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

let sound: Audio.Sound | null = null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowAlert: true,
  }),
});

const REST_CATEGORY = "training-rest";
const REST_CHANNEL = "training-reminders";

// Initialize audio settings
export async function initAudio() {
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
    });
  } catch (e) {
    // Ignore errors in Expo Go
  }
}

export async function primeNotifications() {
  const [allowed] = await Promise.all([
    ensureNotificationPermissions(),
    configureChannels(),
  ]);
  return allowed;
}

export async function ensureNotificationPermissions() {
  try {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.status === "granted") {
      return true;
    }
    const requested = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    });
    return requested.status === "granted";
  } catch {
    return false;
  }
}

async function configureChannels() {
  try {
    await Notifications.setNotificationCategoryAsync(REST_CATEGORY, [
      {
        identifier: "log_set",
        buttonTitle: "Log set",
        options: {
          isAuthenticationRequired: false,
        },
      },
      {
        identifier: "snooze_rest",
        buttonTitle: "Snooze 2m",
        options: {
          isDestructive: false,
        },
      },
    ]);

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(REST_CHANNEL, {
        name: "Training reminders",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 200, 120, 200],
        sound: "default",
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        enableLights: true,
      });
    }
  } catch {
    // Ignore configuration failures in environments that don't support it
  }
}

export async function scheduleRestNotification({
  exerciseName,
  restSeconds,
  planName,
  snoozeSeconds = 120,
}: {
  exerciseName: string;
  restSeconds: number;
  planName?: string;
  snoozeSeconds?: number;
}) {
  const allowed = await ensureNotificationPermissions();
  if (!allowed || restSeconds <= 0) {
    return undefined;
  }

  await configureChannels();

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `${exerciseName} is ready`,
        body:
          "Time to log your next set — act here to stay in flow without reopening the app.",
        sound: true,
        categoryIdentifier: REST_CATEGORY,
        data: {
          type: "rest-reminder",
          exerciseName,
          planName,
          snoozeSeconds,
        },
      },
      trigger: {
        seconds: Math.max(1, Math.round(restSeconds)),
        channelId: REST_CHANNEL,
      },
    });
    return id;
  } catch {
    return undefined;
  }
}

export async function cancelScheduledNotification(notificationId?: string) {
  if (!notificationId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // Ignore cancellation errors
  }
}

// Play a completion sound
export async function playCompletionSound() {
  try {
    // Clean up previous sound
    if (sound) {
      await sound.unloadAsync();
      sound = null;
    }

    // Create and play a simple beep using a bundled sound or system sound
    const { sound: newSound } = await Audio.Sound.createAsync(
      { uri: "https://actions.google.com/sounds/v1/alarms/beep_short.ogg" },
      { shouldPlay: true, volume: 1.0 }
    );
    sound = newSound;

    // Trigger haptic feedback too
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Unload after playing
    newSound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        newSound.unloadAsync();
      }
    });
  } catch (e) {
    // Fallback to just haptics if audio fails
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }
}

// Play a start sound
export async function playStartSound() {
  try {
    if (sound) {
      await sound.unloadAsync();
      sound = null;
    }

    const { sound: newSound } = await Audio.Sound.createAsync(
      {
        uri: "https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg",
      },
      { shouldPlay: true, volume: 0.5 }
    );
    sound = newSound;

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    newSound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        newSound.unloadAsync();
      }
    });
  } catch (e) {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function formatSessionDuration(startedAt: string): string {
  const start = new Date(startedAt).getTime();
  const now = Date.now();
  const seconds = Math.floor((now - start) / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
