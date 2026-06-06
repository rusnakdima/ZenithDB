import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
  inject,
  OnInit,
  OnChanges,
  SimpleChanges,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { QueryGroupComponent } from "./query-group/query-group.component";
import { ConditionGroup, SortConfig, createEmptyGroup } from "../models";
import { FilterBuilderService, SchemaCompletionService } from "../services";
import { FilterExpression } from "@shared/models/connection.config";

@Component({
  selector: "app-visual-query-builder",
  standalone: true,
  imports: [CommonModule, FormsModule, QueryGroupComponent],
  template: `
    <div class="flex h-full flex-col rounded-lg border border-slate-700 bg-slate-900">
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-slate-700 px-4 py-3">
        <div class="flex items-center gap-3">
          <h3 class="text-sm font-medium text-slate-200">Visual Query Builder</h3>
          @if (collectionName) {
            <span class="rounded bg-emerald-500/10 px-2 py-1 text-xs text-emerald-400">
              {{ collectionName }}
            </span>
          }
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            class="rounded px-2 py-1 text-xs text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
            (click)="clearAll()"
          >
            Clear All
          </button>
        </div>
      </div>

      <!-- Query Builder Body -->
      <div class="flex-1 space-y-4 overflow-y-auto p-4">
        <!-- Conditions Group -->
        <app-query-group
          [group]="rootGroup()"
          [collectionName]="collectionName"
          [isNested]="false"
          [isRoot]="true"
          (groupChange)="onGroupChange($event)"
        />

        <!-- Sort Section -->
        <div class="rounded-lg border border-slate-600 bg-slate-800/30 p-3">
          <div class="mb-3 flex items-center gap-2">
            <svg
              class="h-4 w-4 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
              />
            </svg>
            <span class="text-xs tracking-wide text-slate-400 uppercase">Sort</span>
          </div>

          @if (sorts().length > 0) {
            <div class="space-y-2">
              @for (sort of sorts(); track sort.field; let i = $index) {
                <div class="flex items-center gap-2">
                  <select
                    class="rounded border border-slate-600 bg-slate-700 px-2 py-1.5 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
                    [ngModel]="sort.field"
                    (ngModelChange)="updateSortField(i, $event)"
                  >
                    <option value="">Field...</option>
                    @for (field of fields(); track field.name) {
                      <option [value]="field.name">{{ field.name }}</option>
                    }
                  </select>

                  <button
                    type="button"
                    class="rounded px-3 py-1.5 text-xs transition-colors"
                    [class.bg-slate-600]="sort.direction === 'asc'"
                    [class.text-white]="sort.direction === 'asc'"
                    [class.text-slate-400]="sort.direction !== 'asc'"
                    (click)="toggleSortDirection(i)"
                  >
                    {{ sort.direction === "asc" ? "↑ ASC" : "↓ DESC" }}
                  </button>

                  <button
                    type="button"
                    class="p-1 text-slate-500 hover:text-red-400"
                    (click)="removeSort(i)"
                  >
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              }
            </div>
          }

          <button
            type="button"
            class="mt-2 flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-emerald-400"
            (click)="addSort()"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add sort field
          </button>
        </div>

        <!-- Limit Section -->
        <div class="rounded-lg border border-slate-600 bg-slate-800/30 p-3">
          <div class="mb-3 flex items-center gap-2">
            <svg
              class="h-4 w-4 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 6h16M4 10h16M4 14h16M4 18h16"
              />
            </svg>
            <span class="text-xs tracking-wide text-slate-400 uppercase">Limit</span>
          </div>

          <div class="flex items-center gap-4">
            <div class="flex items-center gap-2">
              <label class="text-xs text-slate-400">Skip</label>
              <input
                type="number"
                class="w-20 rounded border border-slate-600 bg-slate-700 px-2 py-1.5 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
                [ngModel]="skip()"
                (ngModelChange)="skip.set($event)"
                min="0"
              />
            </div>

            <div class="flex items-center gap-2">
              <label class="text-xs text-slate-400">Limit</label>
              <input
                type="number"
                class="w-20 rounded border border-slate-600 bg-slate-700 px-2 py-1.5 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
                [ngModel]="limit()"
                (ngModelChange)="limit.set($event)"
                min="1"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Footer with Actions -->
      <div
        class="flex items-center justify-between border-t border-slate-700 bg-slate-800/50 px-4 py-3"
      >
        <div class="text-xs text-slate-500">
          @if (hasConditions()) {
            <span class="text-emerald-400">{{ conditionCount() }} condition(s)</span>
          } @else {
            <span>No conditions</span>
          }
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            class="rounded border border-slate-600 px-4 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
            (click)="onCancel()"
          >
            Cancel
          </button>
          <button
            type="button"
            class="rounded bg-emerald-600 px-4 py-2 text-sm text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            [disabled]="!hasConditions()"
            (click)="onApply()"
          >
            Apply Filter
          </button>
        </div>
      </div>
    </div>
  `,
})
export class VisualQueryBuilderComponent implements OnInit, OnChanges {
  private readonly filterBuilder = inject(FilterBuilderService);
  private readonly schemaCompletion = inject(SchemaCompletionService);

  @Input() collectionName = "";
  @Input() initialFilter: FilterExpression | null = null;
  @Input() initialSort: SortConfig[] = [];
  @Input() initialSkip: number | null = null;
  @Input() initialLimit: number | null = null;

  @Output() filterChange = new EventEmitter<FilterExpression>();
  @Output() sortChange = new EventEmitter<SortConfig[]>();
  @Output() paginationChange = new EventEmitter<{ skip: number | null; limit: number | null }>();
  @Output() cancel = new EventEmitter<void>();
  @Output() apply = new EventEmitter<{
    filter: FilterExpression | null;
    sort: SortConfig[];
    skip: number | null;
    limit: number | null;
  }>();

  rootGroup = signal<ConditionGroup>(createEmptyGroup());
  sorts = signal<SortConfig[]>([]);
  skip = signal<number | null>(null);
  limit = signal<number | null>(null);
  fields = signal<{ name: string; type: string }[]>([]);

  hasConditions = computed(() => {
    const group = this.rootGroup();
    return group.conditions.length > 0 || (group.groups?.length ?? 0) > 0;
  });

  conditionCount = computed(() => {
    const group = this.rootGroup();
    return this.countConditions(group);
  });

  ngOnInit(): void {
    this.loadFields();
    this.initializeFromInputs();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["initialFilter"] && !changes["initialFilter"].firstChange) {
      this.initializeFilter();
    }
  }

  private async loadFields(): Promise<void> {
    if (this.collectionName) {
      const fields = await this.schemaCompletion.getFields(this.collectionName);
      this.fields.set(fields);
    }
  }

  private initializeFromInputs(): void {
    if (this.initialFilter) {
      this.initializeFilter();
    }
    if (this.initialSort.length > 0) {
      this.sorts.set([...this.initialSort]);
    }
    if (this.initialSkip !== null) {
      this.skip.set(this.initialSkip);
    }
    if (this.initialLimit !== null) {
      this.limit.set(this.initialLimit);
    }
  }

  private initializeFilter(): void {
    if (this.initialFilter) {
      const groups = this.filterBuilder.parseFilter(this.initialFilter);
      if (groups.length > 0) {
        this.rootGroup.set(groups[0]);
      }
    }
  }

  private countConditions(group: ConditionGroup): number {
    let count = group.conditions.length;
    if (group.groups) {
      for (const subGroup of group.groups) {
        count += this.countConditions(subGroup);
      }
    }
    return count;
  }

  onGroupChange(group: ConditionGroup): void {
    this.rootGroup.set(group);
  }

  addSort(): void {
    this.sorts.update((s) => [...s, { field: "", direction: "asc" }]);
  }

  updateSortField(index: number, field: string): void {
    this.sorts.update((sorts) => {
      const newSorts = [...sorts];
      newSorts[index] = { ...newSorts[index], field };
      return newSorts;
    });
  }

  toggleSortDirection(index: number): void {
    this.sorts.update((sorts) => {
      const newSorts = [...sorts];
      newSorts[index] = {
        ...newSorts[index],
        direction: newSorts[index].direction === "asc" ? "desc" : "asc",
      };
      return newSorts;
    });
  }

  removeSort(index: number): void {
    this.sorts.update((sorts) => sorts.filter((_, i) => i !== index));
  }

  clearAll(): void {
    this.rootGroup.set(createEmptyGroup());
    this.sorts.set([]);
    this.skip.set(null);
    this.limit.set(null);
  }

  onCancel(): void {
    this.cancel.emit();
  }

  onApply(): void {
    const filter = this.filterBuilder.buildFilter([this.rootGroup()]);
    const validSorts = this.sorts().filter((s) => s.field);

    this.apply.emit({
      filter: filter ?? null,
      sort: validSorts,
      skip: this.skip(),
      limit: this.limit(),
    });
  }
}
