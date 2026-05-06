import {
  Component,
  signal,
  inject,
  computed,
  AfterViewInit,
  ViewChild,
  ElementRef,
  HostListener,
  OnDestroy,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { CommonModule } from "@angular/common";
import { MatIconModule } from "@angular/material/icon";

import { ModalComponent } from "../modal/modal.component";
import { fromEvent, Subscription } from "rxjs";
import { filter } from "rxjs/operators";

interface Command {
  id: string;
  icon: string;
  text: string;
  description?: string;
  shortcut?: string;
  action: string;
  type: "navigation" | "action";
}

interface CommandGroup {
  category: string;
  items: Command[];
}

@Component({
  selector: "app-command-palette",
  standalone: true,
  imports: [FormsModule, CommonModule, MatIconModule],
  templateUrl: "./command-palette.component.html",
})
export class CommandPaletteComponent implements AfterViewInit, OnDestroy {
  @ViewChild("searchInput") searchInput!: ElementRef<HTMLInputElement>;

  visible = signal(false);
  query = signal("");
  selectedIndex = signal(0);
  recentCommands = signal<string[]>([]);

  private router = inject(Router);
  private recentKey = "zenith_recent_commands";
  private maxRecent = 5;
  private subscriptions: Subscription[] = [];

  private allCommands: Command[] = [
    {
      id: "nav-connections",
      icon: "share",
      text: "Go to Connections",
      description: "View all database connections",
      shortcut: "Ctrl+P",
      action: "/connections",
      type: "navigation",
    },
    {
      id: "nav-explorer",
      icon: "folder",
      text: "Go to Explorer",
      description: "Browse collection data",
      shortcut: "Ctrl+G → E",
      action: "/explorer",
      type: "navigation",
    },
    {
      id: "nav-schema",
      icon: "table_chart",
      text: "Go to Schema",
      description: "View database schema",
      shortcut: "Ctrl+G → S",
      action: "/connections/:id/schema",
      type: "navigation",
    },
    {
      id: "nav-query",
      icon: "terminal",
      text: "Go to Query Editor",
      description: "Execute SQL queries",
      shortcut: "Ctrl+G → Q",
      action: "/query",
      type: "navigation",
    },
    {
      id: "nav-workbench",
      icon: "laptop",
      text: "Go to Workbench",
      description: "Database workbench",
      shortcut: "Ctrl+G → W",
      action: "/workbench",
      type: "navigation",
    },
    {
      id: "action-new-connection",
      icon: "add_circle",
      text: "New Connection",
      description: "Add a new database connection",
      shortcut: "Ctrl+N",
      action: "new-connection",
      type: "action",
    },
    {
      id: "action-connection-manager",
      icon: "share",
      text: "Connection Manager",
      description: "Manage active connections",
      shortcut: "Ctrl+Shift+C",
      action: "open-connection-modal",
      type: "action",
    },
    {
      id: "action-run-query",
      icon: "play_arrow",
      text: "Run Selected Query",
      description: "Execute current query",
      shortcut: "Ctrl+Enter",
      action: "run-query",
      type: "action",
    },
    {
      id: "action-format-sql",
      icon: "format_align_left",
      text: "Format SQL",
      description: "Format query text",
      shortcut: "Ctrl+Shift+F",
      action: "format-sql",
      type: "action",
    },
    {
      id: "action-clear-editor",
      icon: "delete_sweep",
      text: "Clear Editor",
      description: "Clear query editor",
      shortcut: "Ctrl+L",
      action: "clear-editor",
      type: "action",
    },
    {
      id: "action-toggle-theme",
      icon: "brightness_6",
      text: "Toggle Theme",
      description: "Switch between light and dark mode",
      action: "toggle-theme",
      type: "action",
    },
    {
      id: "action-show-shortcuts",
      icon: "keyboard",
      text: "Show Keyboard Shortcuts",
      description: "View all shortcuts",
      shortcut: "Ctrl+/",
      action: "show-shortcuts",
      type: "action",
    },
  ];

  filteredCommands = computed(() => {
    const q = this.query().toLowerCase().trim();
    const recent = this.recentCommands();

    let commands = this.allCommands.filter((cmd) => {
      if (!q) return true;
      const textMatch = this.fuzzyMatch(cmd.text.toLowerCase(), q);
      const descMatch = cmd.description && this.fuzzyMatch(cmd.description.toLowerCase(), q);
      return textMatch || descMatch;
    });

    if (recent.length > 0 && !q) {
      const recentCmds = commands.filter((c) => recent.includes(c.id));
      const otherCmds = commands.filter((c) => !recent.includes(c.id));
      return [...recentCmds, ...otherCmds];
    }

    return commands;
  });

  groupedCommands = computed<CommandGroup[]>(() => {
    const items = this.filteredCommands();
    const groups: { [key: string]: Command[] } = {
      recent: [],
      navigation: [],
      action: [],
    };

    const recent = this.recentCommands();

    items.forEach((item) => {
      if (recent.includes(item.id) && !this.query()) {
        groups["recent"].push(item);
      } else if (item.type === "navigation") {
        groups["navigation"].push(item);
      } else {
        groups["action"].push(item);
      }
    });

    const categoryLabels: { [key: string]: string } = {
      recent: "Recent",
      navigation: "Pages",
      action: "Actions",
    };

    return Object.entries(groups)
      .filter(([_, items]) => items.length > 0)
      .map(([category, items]) => ({
        category: categoryLabels[category] || category,
        items,
      }));
  });

  constructor() {
    this.loadRecentCommands();
    this.setupEventListeners();
  }

  ngAfterViewInit(): void {}

  private setupEventListeners(): void {
    this.subscriptions.push(
      fromEvent<KeyboardEvent>(document, "keydown")
        .pipe(filter((e) => e.key === "F1"))
        .subscribe((e) => {
          e.preventDefault();
          this.toggle();
        })
    );

    this.subscriptions.push(
      fromEvent<KeyboardEvent>(document, "keydown")
        .pipe(filter((e) => e.key === "Escape" && this.visible()))
        .subscribe(() => this.hide())
    );

    this.subscriptions.push(
      fromEvent(document, "zenith:toggle-command-palette").subscribe(() => this.toggle())
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.subscriptions = [];
  }

  @HostListener("document:keydown", ["$event"])
  handleKeydown(event: KeyboardEvent): void {
    if (event.key === "F1") {
      event.preventDefault();
      this.toggle();
    }
  }

  private fuzzyMatch(text: string, pattern: string): boolean {
    if (pattern.length === 0) return true;
    if (pattern.length > text.length) return false;

    const patternChars = pattern.split("");
    let patternIdx = 0;

    for (let i = 0; i < text.length && patternIdx < patternChars.length; i++) {
      if (text[i] === patternChars[patternIdx]) {
        patternIdx++;
      }
    }

    return patternIdx === patternChars.length;
  }

  private loadRecentCommands(): void {
    try {
      const stored = localStorage.getItem(this.recentKey);
      if (stored) {
        this.recentCommands.set(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load recent commands, continuing with defaults:", e);
    }
  }

  private saveRecentCommand(id: string): void {
    const recent = this.recentCommands().filter((r) => r !== id);
    recent.unshift(id);
    this.recentCommands.set(recent.slice(0, this.maxRecent));
    try {
      localStorage.setItem(this.recentKey, JSON.stringify(this.recentCommands()));
    } catch (e) {
      console.error("Failed to save recent command:", e);
    }
  }

  toggle(): void {
    if (this.visible()) {
      this.hide();
    } else {
      this.show();
    }
  }

  show(): void {
    this.visible.set(true);
    this.query.set("");
    this.selectedIndex.set(0);
    setTimeout(() => this.searchInput?.nativeElement?.focus(), 50);
  }

  hide(): void {
    this.visible.set(false);
    this.query.set("");
    this.selectedIndex.set(0);
  }

  onSearchInput(value: string): void {
    this.query.set(value);
    this.selectedIndex.set(0);
  }

  onKeydown(event: KeyboardEvent): void {
    const flatItems = this.filteredCommands();
    const len = flatItems.length;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        this.selectedIndex.update((i) => (i + 1) % len);
        break;
      case "ArrowUp":
        event.preventDefault();
        this.selectedIndex.update((i) => (i - 1 + len) % len);
        break;
      case "Enter":
        event.preventDefault();
        if (flatItems.length > 0) {
          this.execute(flatItems[this.selectedIndex()]);
        }
        break;
      case "Escape":
        event.preventDefault();
        this.hide();
        break;
    }
  }

  selectItem(index: number): void {
    this.selectedIndex.set(index);
  }

  selectItemByMouse(index: number): void {
    this.selectedIndex.set(index);
  }

  execute(command: Command): void {
    if (!command) return;

    this.saveRecentCommand(command.id);
    this.hide();

    switch (command.action) {
      case "/connections":
      case "/explorer":
      case "/query":
      case "/workbench":
        this.router.navigate([command.action]);
        break;
      case "/connections/:id/schema":
        const connId = this.getActiveConnectionId();
        if (connId) {
          this.router.navigate(["/connections", connId, "schema"]);
        } else {
          this.router.navigate(["/connections"]);
        }
        break;
      case "new-connection":
        this.router.navigate(["/connections/new"]);
        break;
      case "open-connection-modal":
        document.dispatchEvent(new CustomEvent("zenith:open-connection-modal"));
        break;
      case "run-query":
        document.dispatchEvent(new CustomEvent("zenith:run-query"));
        break;
      case "format-sql":
        document.dispatchEvent(new CustomEvent("zenith:format-sql"));
        break;
      case "clear-editor":
        document.dispatchEvent(new CustomEvent("zenith:clear-editor"));
        break;
      case "toggle-theme":
        document.dispatchEvent(new CustomEvent("zenith:toggle-theme"));
        break;
      case "show-shortcuts":
        document.dispatchEvent(new CustomEvent("zenith:show-shortcuts"));
        break;
    }
  }

  private getActiveConnectionId(): string | null {
    const connId = (window as any).__zenith_active_connection_id;
    return connId || null;
  }

  isRecentCommand(id: string): boolean {
    return this.recentCommands().includes(id);
  }

  getCommandTypeIcon(type: "navigation" | "action"): string {
    return type === "navigation" ? "chevron_right" : "flash_on";
  }

  getGlobalIndex(groupIndex: number, itemIndex: number): number {
    let idx = 0;
    for (let g = 0; g < groupIndex; g++) {
      idx += this.groupedCommands()[g]?.items.length || 0;
    }
    return idx + itemIndex;
  }
}
