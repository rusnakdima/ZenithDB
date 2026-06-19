import { Injectable, signal, effect, inject } from "@angular/core";
import { PersistentStorageService } from "./persistent-storage.service";
type ThemeSetting = "dark" | "light" | "system";
type TabSize = 2 | 4 | 8;

interface GeneralSettings {
  theme: ThemeSetting;
  accentColor: string;
  language: string;
  startMinimized: boolean;
  checkUpdates: boolean;
}

interface EditorSettings {
  fontSize: number;
  tabSize: TabSize;
  autoSave: boolean;
  lineNumbers: boolean;
}

interface DataSettings {
  defaultPageSize: number;
  confirmBeforeDelete: boolean;
  maxRows: number;
}

interface ConnectionSettings {
  connectionTimeout: number;
  maxConcurrent: number;
  autoReconnect: boolean;
}

interface AppSettings {
  general: GeneralSettings;
  editor: EditorSettings;
  data: DataSettings;
  connections: ConnectionSettings;
}

const DEFAULT_SETTINGS: AppSettings = {
  general: {
    theme: "dark",
    accentColor: "#ff6b00",
    language: "en",
    startMinimized: false,
    checkUpdates: true,
  },
  editor: {
    fontSize: 14,
    tabSize: 2,
    autoSave: false,
    lineNumbers: true,
  },
  data: {
    defaultPageSize: 25,
    confirmBeforeDelete: true,
    maxRows: 1000,
  },
  connections: {
    connectionTimeout: 15,
    maxConcurrent: 5,
    autoReconnect: true,
  },
};

@Injectable({ providedIn: "root" })
export class SettingsService {
  private storage = inject(PersistentStorageService);

  private settingsSignal = signal<AppSettings>(this.loadSettings());

  readonly settings = this.settingsSignal;

  constructor() {
    effect(() => {
      this.saveSettings(this.settingsSignal());
    });
  }

  get currentSettings(): AppSettings {
    return this.settingsSignal();
  }

  get(path: string): unknown {
    const keys = path.split(".");
    let value: AppSettings | Record<string, unknown> = this.settingsSignal();
    for (const key of keys) {
      if (value == null || typeof value !== "object") return undefined;
      value = (value as Record<string, unknown>)[key] as Record<string, unknown>;
    }
    return value;
  }

  updateGeneral(partial: Partial<GeneralSettings>): void {
    this.settingsSignal.update((current) => ({
      ...current,
      general: { ...current.general, ...partial },
    }));
  }

  updateEditor(partial: Partial<EditorSettings>): void {
    this.settingsSignal.update((current) => ({
      ...current,
      editor: { ...current.editor, ...partial },
    }));
  }

  updateData(partial: Partial<DataSettings>): void {
    this.settingsSignal.update((current) => ({
      ...current,
      data: { ...current.data, ...partial },
    }));
  }

  updateConnections(partial: Partial<ConnectionSettings>): void {
    this.settingsSignal.update((current) => ({
      ...current,
      connections: { ...current.connections, ...partial },
    }));
  }

  resetToDefaults(): void {
    this.settingsSignal.set(structuredClone(DEFAULT_SETTINGS));
  }

  private loadSettings(): AppSettings {
    try {
      const stored = this.storage.getSettings<AppSettings>();
      if (stored) {
        return this.mergeWithDefaults(stored);
      }
    } catch (e) {}
    return structuredClone(DEFAULT_SETTINGS);
  }

  private saveSettings(settings: AppSettings): void {
    this.storage.setSettings(settings);
  }

  private mergeWithDefaults(stored: Partial<AppSettings>): AppSettings {
    return {
      general: { ...DEFAULT_SETTINGS.general, ...stored.general },
      editor: { ...DEFAULT_SETTINGS.editor, ...stored.editor },
      data: { ...DEFAULT_SETTINGS.data, ...stored.data },
      connections: { ...DEFAULT_SETTINGS.connections, ...stored.connections },
    };
  }
}
