import { Injectable, inject } from "@angular/core";
import { Router } from "@angular/router";
import { Command } from "./command.model";
import { ThemeService } from "@shared/services/theme.service";
import { LoggingService } from "@shared/services/logging.service";
import { findById } from "@shared/utils/array.utils";

@Injectable({ providedIn: "root" })
export class CommandPaletteService {
  private router = inject(Router);
  private themeService = inject(ThemeService);
  private logger = inject(LoggingService);

  private readonly recentCommandsKey = "command_palette_recent";
  private readonly maxRecent = 5;

  readonly commands: Command[] = [
    {
      id: "go-connections",
      label: "Go to Connections",
      category: "navigation",
      shortcut: "Ctrl+1",
      action: () => this.navigateTo("/connections"),
      keywords: ["connections", "home"],
    },
    {
      id: "go-schema",
      label: "Go to Schema",
      category: "navigation",
      shortcut: "Ctrl+2",
      action: () => this.navigateTo("/schema"),
      keywords: ["schema", "database structure"],
    },
    {
      id: "go-query",
      label: "Go to Query Editor",
      category: "navigation",
      shortcut: "Ctrl+3",
      action: () => this.navigateTo("/query"),
      keywords: ["query", "editor", "sql"],
    },
    {
      id: "go-workbench",
      label: "Go to Workbench",
      category: "navigation",
      shortcut: "Ctrl+4",
      action: () => this.navigateTo("/workbench"),
      keywords: ["workbench", "workspace"],
    },
    {
      id: "go-explorer",
      label: "Go to Explorer",
      category: "navigation",
      shortcut: "Ctrl+5",
      action: () => this.navigateTo("/explorer"),
      keywords: ["explorer", "browse", "files"],
    },
    {
      id: "new-connection",
      label: "New Connection",
      category: "action",
      shortcut: "Ctrl+N",
      action: () => this.createConnection(),
      keywords: ["connection", "new", "create"],
    },
    {
      id: "run-query",
      label: "Run Selected Query",
      category: "action",
      shortcut: "Ctrl+Enter",
      action: () => this.runQuery(),
      keywords: ["run", "execute", "query", "sql"],
    },
    {
      id: "toggle-theme",
      label: "Toggle Theme",
      category: "action",
      shortcut: "Ctrl+Shift+T",
      action: () => this.toggleTheme(),
      keywords: ["theme", "dark", "light", "mode"],
    },
    {
      id: "export-view",
      label: "Export Current View",
      category: "action",
      action: () => this.exportView(),
      keywords: ["export", "download", "save"],
    },
    {
      id: "open-settings",
      label: "Open Settings",
      category: "action",
      shortcut: "Ctrl+,",
      action: () => this.openSettings(),
      keywords: ["settings", "preferences", "config"],
    },
    {
      id: "show-shortcuts",
      label: "Show Keyboard Shortcuts",
      category: "action",
      shortcut: "Ctrl+/",
      action: () => this.showShortcuts(),
      keywords: ["shortcuts", "keyboard", "help"],
    },
  ];

  filterCommands(query: string): Command[] {
    if (!query.trim()) {
      return this.commands;
    }

    const lowerQuery = query.toLowerCase();
    const scored: Array<{ command: Command; score: number }> = [];

    for (const command of this.commands) {
      const labelLower = command.label.toLowerCase();
      const keywordsLower = (command.keywords || []).map((k) => k.toLowerCase());

      let score = 0;

      if (labelLower === lowerQuery) {
        score = 100;
      } else if (labelLower.startsWith(lowerQuery)) {
        score = 80;
      } else if (labelLower.includes(lowerQuery)) {
        score = 60;
      } else {
        const keywordMatch = keywordsLower.some((k) => k.includes(lowerQuery));
        if (keywordMatch) {
          score = 40;
        }
      }

      if (score > 0) {
        scored.push({ command, score });
      }
    }

    return scored.sort((a, b) => b.score - a.score).map((item) => item.command);
  }

  addToRecent(command: Command): void {
    const recent = this.getRecent();
    const filtered = recent.filter((c) => c.id !== command.id);
    const updated = [command, ...filtered].slice(0, this.maxRecent);
    localStorage.setItem(this.recentCommandsKey, JSON.stringify(updated));
  }

  getRecent(): Command[] {
    try {
      const stored = localStorage.getItem(this.recentCommandsKey);
      if (stored) {
        const ids = JSON.parse(stored) as string[];
        return ids
          .map((id) => findById(this.commands, id))
          .filter((c): c is Command => c !== undefined);
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      this.logger.warn("[COMMAND_PALETTE]", "Failed to load recent commands", { error });
    }
    return [];
  }

  clearRecent(): void {
    localStorage.removeItem(this.recentCommandsKey);
  }

  private navigateTo(path: string): void {
    this.router.navigate([path]);
  }

  private createConnection(): void {
    document.dispatchEvent(new CustomEvent("zenith:open-connection-modal"));
  }

  private runQuery(): void {
    document.dispatchEvent(new CustomEvent("zenith:run-query"));
  }

  private toggleTheme(): void {
    this.themeService.toggle();
  }

  private exportView(): void {
    document.dispatchEvent(new CustomEvent("zenith:export-view"));
  }

  private openSettings(): void {
    this.router.navigate(["/settings"]);
  }

  private showShortcuts(): void {
    document.dispatchEvent(new CustomEvent("zenith:show-shortcuts"));
  }
}
