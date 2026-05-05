export type SettingsSection = "general" | "editor" | "data" | "connections";

export function updateSettingsSection<T extends Record<string, any>>(
  current: T,
  section: SettingsSection,
  partial: Partial<T[SettingsSection]>
): T {
  return {
    ...current,
    [section]: { ...current[section], ...partial },
  };
}
