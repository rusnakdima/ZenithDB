import { Injectable, signal, effect } from "@angular/core";

export type ThemeSetting = "dark" | "light" | "system";
export type TabSize = 2 | 4 | 8;

export interface GeneralSettings {
  theme: ThemeSetting;
  language: string;
  startMinimized: boolean;
  checkUpdates: boolean;
}

export interface EditorSettings {
  fontSize: number;
  tabSize: TabSize;
  autoSave: boolean;
  lineNumbers: boolean;
}

export interface DataSettings {
  defaultPageSize: number;
  confirmBeforeDelete: boolean;
  maxRows: number;
}

export interface ConnectionSettings {
  connectionTimeout: number;
  maxConcurrent: number;
  autoReconnect: boolean;
}

export interface AppSettings {
  general: GeneralSettings;
  editor: EditorSettings;
  data: DataSettings;
  connections: ConnectionSettings;
}

const DEFAULT_SETTINGS: AppSettings = {
  general: {
    theme: "dark",
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
    connectionTimeout: 30,
    maxConcurrent: 5,
    autoReconnect: true,
  },
};

const STORAGE_KEY = "zenithdb-settings";

@Injectable({ providedIn: "root" })
export class SettingsService {
  private settingsSignal = signal<AppSettings>(this.loadSettings());
  private changeListeners = signal<Array<(settings: AppSettings) => void>>([]);

  readonly settings = this.settingsSignal;

  constructor() {
    effect(() => {
      this.saveSettings(this.settingsSignal());
    });
  }

  get currentSettings(): AppSettings {
    return this.settingsSignal();
  }

  updateSettings(partial: Partial<AppSettings>): void {
    this.settingsSignal.update((current) => ({
      ...current,
      general: { ...current.general, ...partial.general },
      editor: { ...current.editor, ...partial.editor },
      data: { ...current.data, ...partial.data },
      connections: { ...current.connections, ...partial.connections },
    }));
    this.notifyListeners();
  }

  updateGeneral(partial: Partial<GeneralSettings>): void {
    this.settingsSignal.update((current) => ({
      ...current,
      general: { ...current.general, ...partial },
    }));
    this.notifyListeners();
  }

  updateEditor(partial: Partial<EditorSettings>): void {
    this.settingsSignal.update((current) => ({
      ...current,
      editor: { ...current.editor, ...partial },
    }));
    this.notifyListeners();
  }

  updateData(partial: Partial<DataSettings>): void {
    this.settingsSignal.update((current) => ({
      ...current,
      data: { ...current.data, ...partial },
    }));
    this.notifyListeners();
  }

  updateConnections(partial: Partial<ConnectionSettings>): void {
    this.settingsSignal.update((current) => ({
      ...current,
      connections: { ...current.connections, ...partial },
    }));
    this.notifyListeners();
  }

  resetToDefaults(): void {
    this.settingsSignal.set(structuredClone(DEFAULT_SETTINGS));
    this.notifyListeners();
  }

  onSettingsChange(callback: (settings: AppSettings) => void): () => void {
    this.changeListeners.update((listeners) => [...listeners, callback]);
    return () => {
      this.changeListeners.update((listeners) => listeners.filter((l) => l !== callback));
    };
  }

  private notifyListeners(): void {
    const settings = this.settingsSignal();
    this.changeListeners().forEach((listener) => listener(settings));
  }

  private loadSettings(): AppSettings {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return this.mergeWithDefaults(parsed);
      }
    } catch {}
    return structuredClone(DEFAULT_SETTINGS);
  }

  private saveSettings(settings: AppSettings): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
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
