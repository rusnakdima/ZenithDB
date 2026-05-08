import { Component, input, output } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { SplitMode } from "@shared/services/local-storage.service";

type ViewTab = "table" | "tree" | "json";

@Component({
  selector: "app-view-switcher",
  standalone: true,
  imports: [MatIconModule],
  template: `
    <div
      class="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/50 px-4 py-2"
    >
      <div class="flex items-center gap-1">
        @for (tab of viewTabs; track tab.id) {
          <button
            class="relative rounded-t-md px-4 py-2 text-sm font-medium transition-colors"
            [class.text-[var(--accent)]]="activeView() === tab.id"
            [class.text-[var(--text-dim)]]="activeView() !== tab.id"
            (click)="viewChange.emit(tab.id)"
          >
            {{ tab.label }}
            @if (activeView() === tab.id) {
              <div class="absolute right-0 bottom-0 left-0 h-0.5 rounded-t bg-[var(--accent)]"></div>
            }
          </button>
        }
      </div>
      <div class="flex items-center gap-2">
        <span class="text-xs text-[var(--text-dim)]">Split:</span>
        @for (mode of splitModes; track mode.id) {
          <button
            class="rounded p-1.5 transition-colors"
            [class.bg-[var(--accent)]]="splitMode() === mode.id"
            [class.text-black]="splitMode() === mode.id && splitMode() !== 'none'"
            [class.bg-[var(--bg-elevated)]]="splitMode() !== mode.id"
            [class.text-[var(--text-dim)]]="splitMode() !== mode.id"
            (click)="splitChange.emit(mode.id)"
            [title]="mode.label"
          >
            <mat-icon [fontIcon]="mode.icon" class="h-6! w-5! text-xl!" />
          </button>
        }
      </div>
    </div>
  `,
})
export class ViewSwitcherComponent {
  activeView = input<ViewTab>("table");
  splitMode = input<SplitMode>("none");

  viewChange = output<ViewTab>();
  splitChange = output<SplitMode>();

  viewTabs: { id: ViewTab; label: string }[] = [
    { id: "table", label: "Table View" },
    { id: "tree", label: "Tree View" },
    { id: "json", label: "JSON View" },
  ];

  splitModes: { id: SplitMode; label: string; icon: string }[] = [
    { id: "none", label: "No Split", icon: "view_column" },
    { id: "horizontal", label: "Horizontal", icon: "vertical_split" },
    { id: "vertical", label: "Vertical", icon: "horizontal_split" },
  ];
}