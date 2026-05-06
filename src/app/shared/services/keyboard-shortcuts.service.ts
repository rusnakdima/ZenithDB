import { Injectable, signal, NgZone, inject, DestroyRef } from "@angular/core";
import { Router } from "@angular/router";
import {
  SHORTCUT_CONFIG,
  formatShortcut,
  parseKeyEvent,
  ShortcutCategory,
} from "./keyboard-shortcuts.models";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";

@Injectable({ providedIn: "root" })
export class KeyboardShortcutsService {
  private router = inject(Router);
  private zone = inject(NgZone);
  private destroyRef = inject(DestroyRef);

  private enabled = signal(true);

  shortcutsHelpVisible = signal(false);

  private shortcutActions: Record<string, () => void> = {
    "new-connection": () => this.router.navigate(["/connections/new"]),
    "quick-search": () => document.dispatchEvent(new CustomEvent("zenith:focus-search")),
    "open-settings": () => document.dispatchEvent(new CustomEvent("zenith:open-settings")),
    "show-shortcuts": () => this.shortcutsHelpVisible.set(true),
    "close-modal": () => this.closeTopModal(),
    "quit-app": () => document.dispatchEvent(new CustomEvent("zenith:quit-app")),
    "execute-query": () => document.dispatchEvent(new CustomEvent("zenith:run-query")),
    "format-sql": () => document.dispatchEvent(new CustomEvent("zenith:format-sql")),
    "clear-editor": () => document.dispatchEvent(new CustomEvent("zenith:clear-editor")),
    save: () => document.dispatchEvent(new CustomEvent("zenith:save")),
    "duplicate-line": () => document.dispatchEvent(new CustomEvent("zenith:duplicate-line")),
    "open-connection-modal": () =>
      document.dispatchEvent(new CustomEvent("zenith:open-connection-modal")),
  };

  private boundHandler: ((event: KeyboardEvent) => void) | null = null;

  constructor() {
    this.initGlobalListener();
    this.destroyRef.onDestroy(() => {
      if (this.boundHandler) {
        document.removeEventListener("keydown", this.boundHandler);
        this.boundHandler = null;
      }
    });
  }

  private initGlobalListener(): void {
    this.boundHandler = (event: KeyboardEvent) => {
      if (!this.enabled()) return;
      if (this.shouldIgnoreEvent(event)) return;

      const action = this.matchShortcut(event);
      if (action) {
        event.preventDefault();
        event.stopPropagation();

        this.zone.run(() => {
          this.dispatchAction(action, event);
        });
      }
    };
    this.zone.runOutsideAngular(() => {
      document.addEventListener("keydown", this.boundHandler!);
    });
  }

  private shouldIgnoreEvent(event: KeyboardEvent): boolean {
    const target = event.target as HTMLElement;
    const tagName = target?.tagName?.toLowerCase();

    if (tagName === "input" || tagName === "textarea" || target?.isContentEditable) {
      if (event.key === "Escape") return false;
      if (event.ctrlKey && event.key === "Enter") return false;
      return true;
    }

    return false;
  }

  private matchShortcut(event: KeyboardEvent): string | null {
    for (const [action, config] of Object.entries(SHORTCUT_CONFIG)) {
      const hasCtrl = config["modifiers"]?.includes("ctrl");
      const hasShift = config["modifiers"]?.includes("shift");
      const hasMeta = config["modifiers"]?.includes("meta");

      const wantCtrlOrMeta = hasCtrl || hasMeta;
      const hasCtrlOrMeta = event.ctrlKey || event.metaKey;

      if (wantCtrlOrMeta && !hasCtrlOrMeta) continue;
      if (!wantCtrlOrMeta && hasCtrlOrMeta) continue;

      if (hasShift !== event.shiftKey) continue;

      const keyMatch = event.key.toLowerCase() === config.key.toLowerCase();
      if (!keyMatch) continue;

      return action;
    }
    return null;
  }

  private dispatchAction(action: string, _event: KeyboardEvent): void {
    const handler = this.shortcutActions[action];
    if (handler) {
      handler();
    }
  }

  private closeTopModal(): void {
    document.dispatchEvent(new CustomEvent("zenith:close-top-modal"));
  }

  getShortcutsByCategory(): Record<ShortcutCategory, { key: string; desc: string }[]> {
    const result: Record<ShortcutCategory, { key: string; desc: string }[]> = {
      navigation: [],
      actions: [],
      editor: [],
      table: [],
    };

    for (const [action, config] of Object.entries(SHORTCUT_CONFIG)) {
      const display = formatShortcut(config["key"], config["modifiers"]);
      result[config.category].push({ key: display, desc: config.description });
    }

    return result;
  }
}
