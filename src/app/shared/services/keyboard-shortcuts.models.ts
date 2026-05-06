export type ShortcutCategory = "navigation" | "actions" | "editor" | "table";

export interface Shortcut {
  key: string;
  description: string;
  category: ShortcutCategory;
  modifiers?: ("ctrl" | "meta" | "shift" | "alt")[];
}

export const SHORTCUT_CONFIG: Record<string, Shortcut> = {
  "new-connection": {
    key: "n",
    description: "New Connection",
    category: "navigation",
    modifiers: ["ctrl"],
  },
  "quick-search": {
    key: "k",
    description: "Quick Search",
    category: "navigation",
    modifiers: ["ctrl"],
  },
  "open-settings": {
    key: ",",
    description: "Open Settings",
    category: "navigation",
    modifiers: ["ctrl"],
  },
  "show-shortcuts": {
    key: "/",
    description: "Show Shortcuts Help",
    category: "navigation",
    modifiers: ["ctrl"],
  },
  "close-modal": {
    key: "Escape",
    description: "Close Modal/Drawer",
    category: "navigation",
  },
  "quit-app": {
    key: "q",
    description: "Quit Application",
    category: "navigation",
    modifiers: ["ctrl"],
  },
  "execute-query": {
    key: "Enter",
    description: "Execute Query",
    category: "editor",
    modifiers: ["ctrl"],
  },
  "format-sql": {
    key: "f",
    description: "Format SQL",
    category: "editor",
    modifiers: ["ctrl", "shift"],
  },
  "clear-editor": {
    key: "l",
    description: "Clear Editor",
    category: "editor",
    modifiers: ["ctrl"],
  },
  save: {
    key: "s",
    description: "Save",
    category: "editor",
    modifiers: ["ctrl"],
  },
  "duplicate-line": {
    key: "d",
    description: "Duplicate Line",
    category: "editor",
    modifiers: ["ctrl"],
  },
  "open-connection-modal": {
    key: "c",
    description: "Open Connection Manager",
    category: "navigation",
    modifiers: ["ctrl", "shift"],
  },
};

export function formatShortcut(key: string, modifiers?: string[]): string {
  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  const parts: string[] = [];

  if (modifiers?.includes("ctrl") || modifiers?.includes("meta")) {
    parts.push(isMac ? "⌘" : "Ctrl");
  }
  if (modifiers?.includes("shift")) {
    parts.push(isMac ? "⇧" : "Shift");
  }
  if (modifiers?.includes("alt")) {
    parts.push(isMac ? "⌥" : "Alt");
  }

  let displayKey = key;
  switch (key) {
    case "ArrowUp":
      displayKey = "↑";
      break;
    case "ArrowDown":
      displayKey = "↓";
      break;
    case "ArrowLeft":
      displayKey = "←";
      break;
    case "ArrowRight":
      displayKey = "→";
      break;
    case "Enter":
      displayKey = "↵";
      break;
    case "Escape":
      displayKey = "Esc";
      break;
    case "Tab":
      displayKey = "⇥";
      break;
    case "Delete":
      displayKey = "Del";
      break;
  }

  parts.push(displayKey);
  return parts.join(isMac ? "" : "+");
}

export function parseKeyEvent(event: KeyboardEvent): string {
  const parts: string[] = [];
  if (event.ctrlKey) parts.push("ctrl");
  if (event.metaKey) parts.push("meta");
  if (event.shiftKey) parts.push("shift");
  if (event.altKey) parts.push("alt");
  parts.push(event.key);
  return parts.join("+");
}
