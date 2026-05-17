import { Component, input, output, signal } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { CollectionMeta } from "@shared/models/connection.config";

interface Tab {
  name: string;
  collection: string;
}

@Component({
  selector: "app-collection-tabs",
  standalone: true,
  imports: [MatIconModule],
  template: `
    <div
      class="flex items-center gap-1 border-b border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-4 py-2"
    >
      @for (tab of tabs(); track tab.collection) {
        <div
          class="data-tab flex cursor-pointer items-center gap-2 rounded-t-md px-3 py-2 transition-colors"
          [class.bg-[var(--bg-elevated)]]="activeCollection() === tab.collection"
          [class.text-[var(--accent)]]="activeCollection() === tab.collection"
          [class.text-[var(--text-dim)]]="activeCollection() !== tab.collection"
          (click)="tabSelect.emit(tab.collection)"
        >
          <mat-icon fontIcon="table_chart" class="h-6! w-5! text-xl!" />
          <span class="text-sm font-medium">{{ tab.name }}</span>
          <button
            class="close-tab rounded p-0.5 transition-colors hover:bg-[var(--bg-elevated)]"
            (click)="onCloseTab(tab.collection); $event.stopPropagation()"
          >
            <mat-icon fontIcon="close" class="h-6! w-5! text-xl!" />
          </button>
        </div>
      }
      <div class="relative">
        <button
          class="add-tab-btn rounded p-2 text-[var(--text-dim)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--accent)]"
          (click)="toggleSelector.emit()"
        >
          <mat-icon fontIcon="add" class="h-6! w-5! text-xl!" />
        </button>
        @if (showSelector()) {
          <div
            class="absolute left-0 z-[100] mt-1 max-h-64 w-56 overflow-y-auto rounded-lg border border-[var(--border-visible)] bg-[var(--bg-card)] shadow-xl"
          >
            @for (col of collections() || []; track col.name) {
              <button
                class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--text-main)] transition-colors hover:bg-[var(--bg-elevated)]"
                (click)="collectionSelect.emit(col.name)"
              >
                <mat-icon fontIcon="table_chart" class="h-6! w-5! text-xl!" />
                {{ col.name }}
              </button>
            }
            @if (!collections() || collections().length === 0) {
              <div class="p-3 text-center text-sm text-[var(--text-dim)]">No collections</div>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class CollectionTabsComponent {
  tabs = input<Tab[]>([]);
  activeCollection = input<string>("");
  collections = input<CollectionMeta[]>([]);
  showSelector = input<boolean>(false);

  tabSelect = output<string>();
  tabClose = output<string>();
  toggleSelector = output<void>();
  collectionSelect = output<string>();

  onCloseTab(collection: string) {
    this.tabClose.emit(collection);
  }
}
