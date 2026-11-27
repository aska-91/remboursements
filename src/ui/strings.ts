/** All user-facing text lives here so another language can be added later. */
export const strings = {
  appName: "Refund Tracker",
  loading: "Loading…",
  placeholder: "Screens are coming in the next steps.",
  storedCount: (n: number) => `${n} expense${n === 1 ? "" : "s"} stored on this device.`,
  migrated: (n: number) => `${n} expense${n === 1 ? "" : "s"} imported from the previous version.`,
  notPersistent: "Storage is unavailable in this browser window: changes will be lost when it is closed.",
} as const;
