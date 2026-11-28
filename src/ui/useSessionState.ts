import { useState } from "preact/hooks";

/**
 * Like useState, but the value is kept while the app stays open, so a screen
 * that is closed and reopened (switching between Tracking and History) comes back as it was.
 * Nothing is saved to the device: a reload starts from the defaults.
 */
const memory = new Map<string, unknown>();

export function useSessionState<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => (memory.has(key) ? (memory.get(key) as T) : initial));
  return [value, (v: T) => { memory.set(key, v); setValue(v); }];
}
