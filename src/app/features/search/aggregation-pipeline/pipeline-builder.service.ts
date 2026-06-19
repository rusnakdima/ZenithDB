import { Injectable, signal, computed, inject } from "@angular/core";
import {
  ConditionGroup,
  Condition,
  SortConfig,
  createEmptyGroup,
  FieldType,
} from "../../query/models";
import { FilterOperator } from "@app/models/connection.config";
import { logger } from "@core/services/logger.service";

export type StageType =
  | "$match"
  | "$group"
  | "$sort"
  | "$skip"
  | "$limit"
  | "$project"
  | "$replaceRoot";

export interface MatchConfig {
  conditionGroup: ConditionGroup;
}

export interface GroupAccumulator {
  id: string;
  field: string;
  operator: "sum" | "avg" | "min" | "max" | "count" | "push" | "addToSet";
  value?: string;
}

export interface GroupConfig {
  groupByField: string;
  accumulators: GroupAccumulator[];
}

export interface SortStageConfig {
  sorts: SortConfig[];
}

export interface SkipLimitConfig {
  value: number;
}

export interface ProjectField {
  name: string;
  include: boolean;
  expression?: string;
}

export interface ProjectConfig {
  fields: ProjectField[];
}

export interface ReplaceRootConfig {
  expression: string;
}

export type StageConfig =
  | MatchConfig
  | GroupConfig
  | SortStageConfig
  | SkipLimitConfig
  | ProjectConfig
  | ReplaceRootConfig;

export interface PipelineStage {
  id: string;
  type: StageType;
  config: StageConfig;
  order: number;
}

export interface AggregationPipeline {
  stages: PipelineStage[];
}

@Injectable({ providedIn: "root" })
export class PipelineBuilderService {
  private readonly _stages = signal<PipelineStage[]>([]);

  readonly stages = this._stages.asReadonly();

  readonly stageCount = computed(() => this._stages().length);

  readonly isEmpty = computed(() => this._stages().length === 0);

  addStage(type: StageType, config?: StageConfig): void {
    const stage: PipelineStage = {
      id: crypto.randomUUID(),
      type,
      config: config ?? this.getDefaultConfig(type),
      order: this._stages().length,
    };
    logger.info("[SEARCH_PIPELINE]", "Pipeline stage added", { type, config });
    this._stages.update((stages) => [...stages, stage]);
  }

  removeStage(id: string): void {
    logger.debug("[SEARCH_PIPELINE]", "Pipeline stage removed", { id });
    this._stages.update((stages) => {
      const filtered = stages.filter((s) => s.id !== id);
      return filtered.map((s, i) => ({ ...s, order: i }));
    });
  }

  reorderStages(fromIndex: number, toIndex: number): void {
    logger.debug("[SEARCH_PIPELINE]", "Pipeline stages reordered", { fromIndex, toIndex });
    this._stages.update((stages) => {
      const newStages = [...stages];
      const [moved] = newStages.splice(fromIndex, 1);
      newStages.splice(toIndex, 0, moved);
      return newStages.map((s, i) => ({ ...s, order: i }));
    });
  }

  updateStageConfig(id: string, config: StageConfig): void {
    logger.debug("[SEARCH_PIPELINE]", "Pipeline stage config updated", { id, config });
    this._stages.update((stages) => stages.map((s) => (s.id === id ? { ...s, config } : s)));
  }

  moveStageUp(index: number): void {
    if (index > 0) {
      this.reorderStages(index, index - 1);
    }
  }

  moveStageDown(index: number): void {
    if (index < this._stages().length - 1) {
      this.reorderStages(index, index + 1);
    }
  }

  clearAll(): void {
    logger.info("[SEARCH_PIPELINE]", "All pipeline stages cleared");
    this._stages.set([]);
  }

  toJson(): string {
    const pipeline = this.buildPipeline();
    return JSON.stringify(pipeline, null, 2);
  }

  fromJson(json: string): boolean {
    try {
      const parsed = JSON.parse(json);
      if (!Array.isArray(parsed)) {
        return false;
      }
      const stages = this.parsePipeline(parsed);
      this._stages.set(stages);
      logger.info("[SEARCH_PIPELINE]", "Pipeline loaded from JSON", {
        stageCount: stages.length,
      });
      return true;
    } catch {
      return false;
    }
  }

  buildPipeline(): object[] {
    return this._stages().map((stage) => this.stageToAggregation(stage));
  }

  private stageToAggregation(stage: PipelineStage): object {
    switch (stage.type) {
      case "$match": {
        const config = stage.config as MatchConfig;
        return { $match: this.conditionGroupToQuery(config.conditionGroup) };
      }
      case "$group": {
        const config = stage.config as GroupConfig;
        return { $group: this.groupConfigToAggregation(config) };
      }
      case "$sort": {
        const config = stage.config as SortStageConfig;
        const sortObj: Record<string, 1 | -1> = {};
        for (const s of config.sorts) {
          if (s.field) {
            sortObj[s.field] = s.direction === "asc" ? 1 : -1;
          }
        }
        return { $sort: sortObj };
      }
      case "$skip": {
        const config = stage.config as SkipLimitConfig;
        return { $skip: config.value };
      }
      case "$limit": {
        const config = stage.config as SkipLimitConfig;
        return { $limit: config.value };
      }
      case "$project": {
        const config = stage.config as ProjectConfig;
        return { $project: this.projectConfigToAggregation(config) };
      }
      case "$replaceRoot": {
        const config = stage.config as ReplaceRootConfig;
        return { $replaceRoot: { newRoot: JSON.parse(config.expression || "{}") } };
      }
      default:
        return {};
    }
  }

  private conditionGroupToQuery(group: ConditionGroup): object {
    const conditions = group.conditions.filter((c) => c.field && c.operator);
    const subGroups = group.groups ?? [];

    const expressions: object[] = [];

    for (const cond of conditions) {
      expressions.push(this.conditionToQuery(cond));
    }

    for (const subGroup of subGroups) {
      expressions.push(this.conditionGroupToQuery(subGroup));
    }

    if (expressions.length === 0) return {};
    if (expressions.length === 1) return expressions[0];

    return group.operator === "and" ? { $and: expressions } : { $or: expressions };
  }

  private conditionToQuery(cond: Condition): object {
    const field = cond.field;
    const value = cond.value;

    switch (cond.operator) {
      case "eq":
        return { [field]: value };
      case "neq":
        return { [field]: { $ne: value } };
      case "gt":
        return { [field]: { $gt: value } };
      case "gte":
        return { [field]: { $gte: value } };
      case "lt":
        return { [field]: { $lt: value } };
      case "lte":
        return { [field]: { $lte: value } };
      case "contains":
        return { [field]: { $regex: value, $options: "i" } };
      case "startsWith":
        return { [field]: { $regex: `^${value}`, $options: "i" } };
      case "endsWith":
        return { [field]: { $regex: `${value}$`, $options: "i" } };
      case "like":
        return { [field]: { $regex: value } };
      case "isNull":
        return { [field]: null };
      case "isNotNull":
        return { [field]: { $ne: null } };
      case "in":
        return { [field]: { $in: Array.isArray(value) ? value : [value] } };
      case "notIn":
        return { [field]: { $nin: Array.isArray(value) ? value : [value] } };
      case "between":
        if (Array.isArray(value) && value.length >= 2) {
          return { [field]: { $gte: value[0], $lte: value[1] } };
        }
        return { [field]: value };
      default:
        return { [field]: value };
    }
  }

  private groupConfigToAggregation(config: GroupConfig): object {
    const result: Record<string, unknown> = {};

    if (config.groupByField) {
      result["_id"] = `$${config.groupByField}`;
    } else {
      result["_id"] = null;
    }

    for (const acc of config.accumulators) {
      if (!acc.field) continue;

      switch (acc.operator) {
        case "sum":
          result[acc.field] = { $sum: acc.value ? `$${acc.value}` : 1 };
          break;
        case "avg":
          result[acc.field] = { $avg: `$${acc.value || acc.field}` };
          break;
        case "min":
          result[acc.field] = { $min: `$${acc.value || acc.field}` };
          break;
        case "max":
          result[acc.field] = { $max: `$${acc.value || acc.field}` };
          break;
        case "count":
          result[acc.field] = { $sum: 1 };
          break;
        case "push":
          result[acc.field] = { $push: `$${acc.value || acc.field}` };
          break;
        case "addToSet":
          result[acc.field] = { $addToSet: `$${acc.value || acc.field}` };
          break;
      }
    }

    return result;
  }

  private projectConfigToAggregation(config: ProjectConfig): object {
    const result: Record<string, unknown> = {};

    for (const field of config.fields) {
      if (field.expression) {
        result[field.name] = JSON.parse(field.expression);
      } else {
        result[field.name] = field.include ? 1 : 0;
      }
    }

    return result;
  }

  private parsePipeline(pipeline: object[]): PipelineStage[] {
    const stages: PipelineStage[] = [];

    for (let i = 0; i < pipeline.length; i++) {
      const stage = pipeline[i];
      const stageKeys = Object.keys(stage);

      if (stageKeys.length === 0) continue;

      const type = stageKeys[0] as StageType;
      const value = (stage as Record<string, unknown>)[type];

      let config: StageConfig | undefined;
      let parsed = false;

      switch (type) {
        case "$match":
          config = { conditionGroup: this.queryToConditionGroup(value as Record<string, unknown>) };
          parsed = true;
          break;
        case "$group":
          config = this.aggregationToGroupConfig(value as Record<string, unknown>);
          parsed = true;
          break;
        case "$sort":
          config = this.aggregationToSortConfig(value as Record<string, unknown>);
          parsed = true;
          break;
        case "$skip":
          config = { value: typeof value === "number" ? value : 0 };
          parsed = true;
          break;
        case "$limit":
          config = { value: typeof value === "number" ? value : 0 };
          parsed = true;
          break;
        case "$project":
          config = this.aggregationToProjectConfig(value as Record<string, unknown>);
          parsed = true;
          break;
        case "$replaceRoot":
          const replaceRootValue = value as Record<string, unknown>;
          config = { expression: JSON.stringify(replaceRootValue["newRoot"] || {}) };
          parsed = true;
          break;
      }

      if (parsed) {
        stages.push({
          id: crypto.randomUUID(),
          type,
          config: config!,
          order: i,
        });
      }
    }

    return stages;
  }

  private queryToConditionGroup(query: Record<string, unknown>): ConditionGroup {
    const group = createEmptyGroup();

    if (!query) return group;

    const queryAnd = query["$and"];
    const queryOr = query["$or"];

    if (queryAnd) {
      group.operator = "and";
      group.conditions = [];
      group.groups = (queryAnd as Record<string, unknown>[]).map((q) =>
        this.queryToConditionGroup(q)
      );
    } else if (queryOr) {
      group.operator = "or";
      group.conditions = [];
      group.groups = (queryOr as Record<string, unknown>[]).map((q) =>
        this.queryToConditionGroup(q)
      );
    } else {
      const field = Object.keys(query)[0];
      if (field) {
        const value = query[field];
        if (value && typeof value === "object" && !Array.isArray(value)) {
          const op = Object.keys(value as object)[0];
          const opValue = (value as Record<string, unknown>)[op];
          const queryField = field as keyof typeof query;
          group.conditions = [
            {
              id: crypto.randomUUID(),
              field,
              operator: this.mapOperator(op),
              value: opValue,
              valueType: typeof opValue as FieldType,
            },
          ];
        } else {
          group.conditions = [
            {
              id: crypto.randomUUID(),
              field,
              operator: "eq",
              value,
              valueType: typeof value as FieldType,
            },
          ];
        }
      }
    }

    return group;
  }

  private mapOperator(op: string): FilterOperator {
    const opMap: Record<string, FilterOperator> = {
      $eq: "eq",
      $ne: "neq",
      $gt: "gt",
      $gte: "gte",
      $lt: "lt",
      $lte: "lte",
      $regex: "contains",
      $in: "in",
      $nin: "notIn",
    };
    return opMap[op] || "eq";
  }

  private aggregationToGroupConfig(agg: Record<string, unknown>): GroupConfig {
    const config: GroupConfig = { groupByField: "", accumulators: [] };

    const aggId = agg["_id"];
    if (aggId !== undefined) {
      const idStr = String(aggId);
      if (idStr.startsWith("$")) {
        config.groupByField = idStr.substring(1);
      }
    }

    for (const [key, value] of Object.entries(agg)) {
      if (key === "_id") continue;
      if (!value || typeof value !== "object") continue;

      const op = Object.keys(value as object)[0];
      const opValue = (value as Record<string, unknown>)[op];

      let operator: GroupAccumulator["operator"] = "sum";
      let fieldValue = "";

      switch (op) {
        case "$sum":
          operator = "sum";
          fieldValue = typeof opValue === "number" ? "" : String(opValue).replace(/^\$/, "");
          break;
        case "$avg":
          operator = "avg";
          fieldValue = String(opValue).replace(/^\$/, "");
          break;
        case "$min":
          operator = "min";
          fieldValue = String(opValue).replace(/^\$/, "");
          break;
        case "$max":
          operator = "max";
          fieldValue = String(opValue).replace(/^\$/, "");
          break;
        case "$push":
          operator = "push";
          fieldValue = String(opValue).replace(/^\$/, "");
          break;
        case "$addToSet":
          operator = "addToSet";
          fieldValue = String(opValue).replace(/^\$/, "");
          break;
      }

      config.accumulators.push({
        id: crypto.randomUUID(),
        field: key,
        operator,
        value: fieldValue,
      });
    }

    return config;
  }

  private aggregationToSortConfig(sort: Record<string, unknown>): SortStageConfig {
    const sorts: SortConfig[] = [];

    for (const [field, direction] of Object.entries(sort)) {
      sorts.push({
        field,
        direction: direction === 1 ? "asc" : "desc",
      });
    }

    return { sorts };
  }

  private aggregationToProjectConfig(proj: Record<string, unknown>): ProjectConfig {
    const fields: ProjectField[] = [];

    for (const [name, value] of Object.entries(proj)) {
      if (value === 1) {
        fields.push({ name, include: true });
      } else if (value === 0) {
        fields.push({ name, include: false });
      } else {
        fields.push({ name, include: true, expression: JSON.stringify(value) });
      }
    }

    return { fields };
  }

  private getDefaultConfig(type: StageType): StageConfig {
    switch (type) {
      case "$match":
        return { conditionGroup: createEmptyGroup() };
      case "$group":
        return { groupByField: "", accumulators: [] };
      case "$sort":
        return { sorts: [] };
      case "$skip":
      case "$limit":
        return { value: 0 };
      case "$project":
        return { fields: [] };
      case "$replaceRoot":
        return { expression: "{}" };
      default:
        return { conditionGroup: createEmptyGroup() };
    }
  }
}
