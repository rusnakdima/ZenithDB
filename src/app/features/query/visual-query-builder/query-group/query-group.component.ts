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
import { logger } from "@core/services/logger.service";

@Component({
  selector: "app-query-group",
  standalone: true,
  imports: [CommonModule, QueryConditionComponent],
  templateUrl: "./query-group.component.html",
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
    logger.debug("[QUERY]", "Adding condition to group");
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
    logger.debug("[QUERY]", "Adding nested group");
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
