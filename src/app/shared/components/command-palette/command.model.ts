export interface Command {
  id: string;
  label: string;
  category: "navigation" | "action" | "recent";
  shortcut?: string;
  icon?: string;
  action: () => void;
  keywords?: string[];
}
