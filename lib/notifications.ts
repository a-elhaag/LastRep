// Simple timer utilities - no external notification dependencies
// Works in Expo Go without issues

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
