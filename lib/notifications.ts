// Timer utilities with audio notifications
// Works in Expo Go without issues

import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";

let sound: Audio.Sound | null = null;

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
