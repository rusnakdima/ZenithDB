import { Injectable, inject } from "@angular/core";
import { FilterExpression, FilterOperator } from "@entities/entities.connection.config";
import {
  ConditionGroup,
  Condition,
  QueryBuilderState,
  SortConfig,
  ProjectionConfig,
  FieldType,
} from "../models";
@Injectable({ providedIn: "root" })
export class FilterBuilderService {
  buildFilter(groups: ConditionGroup[]): FilterExpression | null {
    if (!groups || groups.length === 0) return null;

    if (groups.length === 1) {
      return this.groupToFilter(groups[0]);
    }

    return {
      and: groups
        .map((g) => this.groupToFilter(g))
        .filter((f): f is FilterExpression => f !== null),
    };
  }

  private groupToFilter(group: ConditionGroup): FilterExpression | null {
    const conditions = this.extractConditions(group);
    const subGroups = this.extractSubGroups(group);

    const allExpressions: FilterExpression[] = [];

    if (conditions.length > 0) {
      const filterExpr = this.conditionsToFilter(conditions, group.operator);
      if (filterExpr) allExpressions.push(filterExpr);
    }

    if (subGroups.length > 0) {
      const subFilters = subGroups
        .map((g) => this.groupToFilter(g))
        .filter((f): f is FilterExpression => f !== null);

      if (group.operator === "and") {
        const andFilter: FilterExpression = { and: [] };
        allExpressions.forEach((f) => {
          if (f.and) (andFilter.and as FilterExpression[]).push(...f.and);
          else andFilter.and!.push(f);
        });
        subFilters.forEach((f) => {
          if (f.and) (andFilter.and as FilterExpression[]).push(...f.and);
          else andFilter.and!.push(f);
        });
        return andFilter;
      } else {
        allExpressions.push(...subFilters);
      }
    }

    if (allExpressions.length === 0) return null;
    if (allExpressions.length === 1) return allExpressions[0];

    return group.operator === "and" ? { and: allExpressions } : { or: allExpressions };
  }

  private extractConditions(group: ConditionGroup): Condition[] {
    return group.conditions.filter((c) => c.field && c.operator);
  }

  private extractSubGroups(group: ConditionGroup): ConditionGroup[] {
    return group.groups ?? [];
  }

  private conditionsToFilter(
    conditions: Condition[],
    operator: "and" | "or"
  ): FilterExpression | null {
    const expressions = conditions
      .map((c) => this.conditionToFilter(c))
      .filter((f): f is FilterExpression => f !== null);

    if (expressions.length === 0) return null;
    if (expressions.length === 1) return expressions[0];

    return operator === "and" ? { and: expressions } : { or: expressions };
  }

  private conditionToFilter(condition: Condition): FilterExpression | null {
    if (!condition.field || !condition.operator) return null;

    return {
      field: condition.field,
      operator: condition.operator,
      value: condition.value,
    };
  }

  parseFilter(expr: FilterExpression | null): ConditionGroup[] {
    if (!expr) return [];

    const groups: ConditionGroup[] = [];
    const converted = this.filterToGroup(expr, "and");
    if (converted) groups.push(converted);

    return groups;
  }

  private filterToGroup(filter: FilterExpression, defaultOp: "and" | "or"): ConditionGroup | null {
    if (filter.and && filter.and.length > 0) {
      const group: ConditionGroup = {
        id: crypto.randomUUID(),
        operator: "and",
        conditions: [],
        groups: [],
      };

      for (const subFilter of filter.and) {
        if (this.isSimpleFilter(subFilter)) {
          group.conditions.push(this.filterToCondition(subFilter, "and"));
        } else {
          const subGroup = this.filterToGroup(subFilter, "and");
          if (subGroup) group.groups!.push(subGroup);
        }
      }

      return group;
    }

    if (filter.or && filter.or.length > 0) {
      const group: ConditionGroup = {
        id: crypto.randomUUID(),
        operator: "or",
        conditions: [],
        groups: [],
      };

      for (const subFilter of filter.or) {
        if (this.isSimpleFilter(subFilter)) {
          group.conditions.push(this.filterToCondition(subFilter, "or"));
        } else {
          const subGroup = this.filterToGroup(subFilter, "or");
          if (subGroup) group.groups!.push(subGroup);
        }
      }

      return group;
    }

    if (filter.not) {
      const innerGroup = this.filterToGroup(filter.not, "and");
      if (innerGroup) {
        return {
          id: crypto.randomUUID(),
          operator: "and",
          conditions: [
            {
              id: crypto.randomUUID(),
              field: "_not",
              operator: "eq",
              value: JSON.stringify(filter.not),
              valueType: "string" as FieldType,
            },
          ],
          groups: [innerGroup],
        };
      }
    }

    if (filter.field && filter.operator) {
      return {
        id: crypto.randomUUID(),
        operator: defaultOp,
        conditions: [this.filterToCondition(filter, defaultOp)],
        groups: [],
      };
    }

    return null;
  }

  private isSimpleFilter(filter: FilterExpression): boolean {
    return !filter.and && !filter.or && !filter.not;
  }

  private filterToCondition(filter: FilterExpression, defaultOp: "and" | "or"): Condition {
    return {
      id: crypto.randomUUID(),
      field: filter.field ?? "",
      operator: filter.operator ?? "eq",
      value: filter.value ?? "",
      valueType: this.inferValueType(filter.value),
    };
  }

  private inferValueType(value: unknown): FieldType {
    if (value === null || value === undefined) return "string";
    if (typeof value === "boolean") return "boolean";
    if (typeof value === "number") return "number";
    if (Array.isArray(value)) return "array";
    if (typeof value === "object") return "object";
    return "string";
  }

  validateFilter(expr: FilterExpression): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    this.validateExpression(expr, errors, warnings);
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private validateExpression(expr: FilterExpression, errors: string[], warnings: string[]): void {
    if (!expr) return;

    if (expr.and) {
      if (expr.and.length === 0) {
        errors.push("Empty AND group");
      } else {
        expr.and.forEach((sub) => this.validateExpression(sub, errors, warnings));
      }
    }

    if (expr.or) {
      if (expr.or.length === 0) {
        errors.push("Empty OR group");
      } else {
        expr.or.forEach((sub) => this.validateExpression(sub, errors, warnings));
      }
    }

    if (expr.not) {
      this.validateExpression(expr.not, errors, warnings);
    }

    if (expr.field && !expr.operator) {
      errors.push(`Field "${expr.field}" missing operator`);
    }

    if (expr.operator && !expr.field && !expr.and && !expr.or && !expr.not) {
      errors.push(`Operator "${expr.operator}" missing field`);
    }

    if (expr.operator === "between" && !Array.isArray(expr.value)) {
      warnings.push("BETWEEN operator expects array value [min, max]");
    }

    if (expr.operator === "in" && !Array.isArray(expr.value)) {
      warnings.push("IN operator expects array value");
    }
  }

  buildSortConfig(sorts: SortConfig[]): { order_by: string; direction: "asc" | "desc" }[] {
    return sorts
      .filter((s) => s.field)
      .map((s) => ({
        order_by: s.field,
        direction: s.direction,
      }));
  }

  buildProjectionConfig(projection: ProjectionConfig | null): string[] | undefined {
    if (!projection) return undefined;
    return projection.exclude ? projection.fields.map((f) => `-${f}`) : projection.fields;
  }
}
