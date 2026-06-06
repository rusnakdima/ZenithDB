import { Component, Input, Output, EventEmitter, signal, inject, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { QueryConditionComponent } from "../query-condition/query-condition.component";
import {
  ConditionGroup,
  Condition,
  createEmptyCondition,
  createEmptyGroup,
  FieldInfo,
} from "../../models";
import { SchemaCompletionService } from "../../services";

@Component({
  selector: "app-query-group",
  standalone: true,
  imports: [CommonModule, QueryConditionComponent],
  template: `
    <div class="relative rounded-lg border border-slate-600 bg-slate-800/30 p-3">
      <!-- Connector Line -->
      @if (isNested) {
        <div
          class="absolute top-0 bottom-0 -left-4 w-4 rounded-tl-lg border-t-2 border-l-2 border-t-slate-600 border-l-slate-600"
        ></div>
      }

      <!-- Group Header -->
      <div class="mb-3 flex items-center gap-3 border-b border-slate-700 pb-2">
        <span class="text-xs tracking-wide text-slate-400 uppercase">Match</span>

        <div class="flex items-center gap-1 rounded bg-slate-700 p-0.5">
          <button
            type="button"
            class="rounded px-3 py-1 text-xs transition-colors"
            [class.bg-emerald-600]="group.operator === 'and'"
            [class.text-white]="group.operator === 'and'"
            [class.text-slate-400]="group.operator !== 'and'"
            [class.hover:text-white]="group.operator !== 'and'"
            (click)="setOperator('and')"
          >
            ALL
          </button>
          <button
            type="button"
            class="rounded px-3 py-1 text-xs transition-colors"
            [class.bg-amber-600]="group.operator === 'or'"
            [class.text-white]="group.operator === 'or'"
            [class.text-slate-400]="group.operator !== 'or'"
            [class.hover:text-white]="group.operator !== 'or'"
            (click)="setOperator('or')"
          >
            ANY
          </button>
        </div>

        <span class="text-xs text-slate-500"> of the following conditions: </span>

        @if (!isRoot) {
          <button
            type="button"
            class="ml-auto p-1 text-slate-500 hover:text-red-400"
            (click)="onRemoveGroup()"
            title="Remove group"
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
        }
      </div>

      <!-- Conditions -->
      <div class="space-y-2">
        @for (condition of group.conditions; track condition.id) {
          <app-query-condition
            [condition]="condition"
            [collectionName]="collectionName"
            (conditionChange)="onConditionChange($event, condition.id)"
            (remove)="onRemoveCondition(condition.id)"
          />
        }
      </div>

      <!-- Add Condition Button -->
      <button
        type="button"
        class="mt-3 flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-emerald-400"
        (click)="addCondition()"
      >
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 4v16m8-8H4"
          />
        </svg>
        Add condition
      </button>

      <!-- Nested Groups -->
      @if (group.groups && group.groups!.length > 0) {
        <div class="mt-4 space-y-3 border-l-2 border-slate-700 pl-4">
          @for (subGroup of group.groups!; track subGroup.id) {
            <app-query-group
              [group]="subGroup"
              [collectionName]="collectionName"
              [isNested]="true"
              (groupChange)="onSubGroupChange($event, subGroup.id)"
              (removeGroup)="onRemoveSubGroup(subGroup.id)"
            />
          }
        </div>
      }

      <!-- Add Nested Group Button -->
      <button
        type="button"
        class="mt-3 flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-amber-400"
        (click)="addNestedGroup()"
      >
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
        Add condition group
      </button>
    </div>
  `,
})
export class QueryGroupComponent implements OnInit {
  private readonly schemaCompletion = inject(SchemaCompletionService);

  @Input() group!: ConditionGroup;
  @Input() collectionName = "";
  @Input() isNested = false;
  @Input() isRoot = false;

  @Output() groupChange = new EventEmitter<ConditionGroup>();
  @Output() removeGroup = new EventEmitter<void>();

  ngOnInit(): void {}

  setOperator(operator: "and" | "or"): void {
    this.groupChange.emit({
      ...this.group,
      operator,
    });
  }

  onConditionChange(condition: Condition, conditionId: string): void {
    const conditions = this.group.conditions.map((c) => (c.id === conditionId ? condition : c));
    this.groupChange.emit({
      ...this.group,
      conditions,
    });
  }

  onRemoveCondition(conditionId: string): void {
    const conditions = this.group.conditions.filter((c) => c.id !== conditionId);
    if (conditions.length === 0 && !this.isRoot) {
      this.removeGroup.emit();
    } else {
      this.groupChange.emit({
        ...this.group,
        conditions,
      });
    }
  }

  addCondition(): void {
    const conditions = [...this.group.conditions, createEmptyCondition()];
    this.groupChange.emit({
      ...this.group,
      conditions,
    });
  }

  onSubGroupChange(subGroup: ConditionGroup, subGroupId: string): void {
    const groups = this.group.groups?.map((g) => (g.id === subGroupId ? subGroup : g)) ?? [];
    this.groupChange.emit({
      ...this.group,
      groups,
    });
  }

  onRemoveSubGroup(subGroupId: string): void {
    const groups = this.group.groups?.filter((g) => g.id !== subGroupId) ?? [];
    this.groupChange.emit({
      ...this.group,
      groups,
    });
  }

  addNestedGroup(): void {
    const groups = [
      ...(this.group.groups ?? []),
      createEmptyGroup(this.group.operator === "or" ? "or" : "and"),
    ];
    this.groupChange.emit({
      ...this.group,
      groups,
    });
  }

  onRemoveGroup(): void {
    this.removeGroup.emit();
  }
}
