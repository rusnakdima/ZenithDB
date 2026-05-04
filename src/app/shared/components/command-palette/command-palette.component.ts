import {
  Component,
  signal,
  inject,
  computed,
  AfterViewInit,
  ViewChild,
  ElementRef,
  HostListener,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { fromEvent } from "rxjs";
import { filter } from "rxjs/operators";

interface Command {
  id: string;
  icon: string;
  text: string;
  shortcut?: string;
  action: string;
  type: "navigation" | "action";
}

@Component({
  selector: "app-command-palette",
  standalone: true,
  imports: [FormsModule],
  templateUrl: "./command-palette.component.html",
})
export class CommandPaletteComponent implements AfterViewInit {
  @ViewChild("searchInput") searchInput!: ElementRef<HTMLInputElement>;

  visible = signal(false);
  query = signal("");
  selectedIndex = signal(0);
  recentCommands = signal<string[]>([]);

  private router = inject(Router);
  private recentKey = "zenith_recent_commands";
  private maxRecent = 5;

  private allCommands: Command[] = [
    {
      id: "nav-connections",
      icon: "fa-plug",
      text: "Go to Connections",
      shortcut: "Ctrl+P",
      action: "/connections",
      type: "navigation",
    },
    {
      id: "nav-schema",
      icon: "fa-table",
      text: "Go to Schema",
      shortcut: "Ctrl+G → S",
      action: "/schema",
      type: "navigation",
    },
    {
      id: "nav-query",
      icon: "fa-terminal",
      text: "Go to Query Editor",
      shortcut: "Ctrl+G → Q",
      action: "/query",
      type: "navigation",
    },
    {
      id: "nav-workbench",
      icon: "fa-laptop",
      text: "Go to Workbench",
      shortcut: "Ctrl+G → W",
      action: "/workbench",
      type: "navigation",
    },
    {
      id: "nav-explorer",
      icon: "fa-folder-tree",
      text: "Go to Explorer",
      shortcut: "Ctrl+G → E",
      action: "/explorer",
      type: "navigation",
    },
    {
      id: "action-new-connection",
      icon: "fa-plus",
      text: "New Connection",
      shortcut: "Ctrl+N",
      action: "new-connection",
      type: "action",
    },
    {
      id: "action-run-query",
      icon: "fa-play",
      text: "Run Selected Query",
      shortcut: "Ctrl+Enter",
      action: "run-query",
      type: "action",
    },
    {
      id: "action-format-sql",
      icon: "fa-align-left",
      text: "Format SQL",
      shortcut: "Ctrl+Shift+F",
      action: "format-sql",
      type: "action",
    },
    {
      id: "action-clear-editor",
      icon: "fa-eraser",
      text: "Clear Editor",
      shortcut: "Ctrl+L",
      action: "clear-editor",
      type: "action",
    },
    {
      id: "action-toggle-theme",
      icon: "fa-circle-half-stroke",
      text: "Toggle Theme",
      action: "toggle-theme",
      type: "action",
    },
    {
      id: "action-show-shortcuts",
      icon: "fa-keyboard",
      text: "Show Keyboard Shortcuts",
      shortcut: "Ctrl+/",
      action: "show-shortcuts",
      type: "action",
    },
    {
      id: "action-export",
      icon: "fa-download",
      text: "Export Current View",
      action: "export",
      type: "action",
    },
  ];

  filteredCommands = computed(() => {
    const q = this.query().toLowerCase().trim();
    const recent = this.recentCommands();

    let commands = this.allCommands.filter((cmd) => {
      if (!q) return true;
      const text = cmd.text.toLowerCase();
      const words = q.split(" ").filter(Boolean);
      return words.every((word) => text.includes(word));
    });

    if (recent.length > 0 && !q) {
      const recentCmds = commands.filter((c) => recent.includes(c.id));
      const otherCmds = commands.filter((c) => !recent.includes(c.id));
      return [...recentCmds, ...otherCmds];
    }

    return commands;
  });

  constructor() {
    this.loadRecentCommands();
    this.setupEventListeners();
  }

  ngAfterViewInit(): void {}

  private setupEventListeners(): void {
    fromEvent<KeyboardEvent>(document, "keydown")
      .pipe(filter((e) => (e.ctrlKey || e.metaKey) && e.key === "p"))
      .subscribe((e) => {
        e.preventDefault();
        this.toggle();
      });

    fromEvent<KeyboardEvent>(document, "keydown")
      .pipe(filter((e) => e.key === "Escape" && this.visible()))
      .subscribe(() => this.hide());

    fromEvent(document, "zenith:toggle-command-palette").subscribe(() => this.toggle());
  }

  @HostListener("document:keydown", ["$event"])
  handleKeydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key === "p") {
      event.preventDefault();
      this.toggle();
    }
  }

  private loadRecentCommands(): void {
    try {
      const stored = localStorage.getItem(this.recentKey);
      if (stored) {
        this.recentCommands.set(JSON.parse(stored));
      }
    } catch {}
  }

  private saveRecentCommand(id: string): void {
    const recent = this.recentCommands().filter((r) => r !== id);
    recent.unshift(id);
    this.recentCommands.set(recent.slice(0, this.maxRecent));
    try {
      localStorage.setItem(this.recentKey, JSON.stringify(this.recentCommands()));
    } catch {}
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
    const commands = this.filteredCommands();
    const len = commands.length;

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
        if (commands.length > 0) {
          this.execute(commands[this.selectedIndex()]);
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

  execute(command: Command): void {
    if (!command) return;

    this.saveRecentCommand(command.id);
    this.hide();

    switch (command.action) {
      case "/connections":
      case "/schema":
      case "/query":
      case "/workbench":
      case "/explorer":
        this.router.navigate([command.action]);
        break;
      case "new-connection":
        this.router.navigate(["/connections/new"]);
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
      case "export":
        document.dispatchEvent(new CustomEvent("zenith:export-view"));
        break;
    }
  }

  onOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains("overlay")) {
      this.hide();
    }
  }

  isRecentCommand(id: string): boolean {
    return this.recentCommands().includes(id);
  }

  getCommandTypeIcon(type: "navigation" | "action"): string {
    return type === "navigation" ? "fa-chevron-right text-[10px]" : "fa-unity text-[10px]";
  }
}
