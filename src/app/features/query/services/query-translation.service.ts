import { Injectable, inject } from "@angular/core";
import { FilterExpression, FilterOperator } from "@app/models/connection.config";
import { ProviderDetectorService } from "./provider-detector.service";
import { SyntaxMode } from "../models";
import { MONGO_OPERATOR_MAP } from "@shared/utils/operator.utils";
import { escapeSqlValue } from "@shared/utils/string.utils";
import { logger } from "@core/services/logger.service";

export interface TranslationResult {
  query: string;
  errors: string[];
  warnings: string[];
}

@Injectable({ providedIn: "root" })
export class QueryTranslationService {
  private readonly providerDetector = inject(ProviderDetectorService);

  translateToProvider(filter: FilterExpression, mode?: SyntaxMode): TranslationResult {
    const syntaxMode = mode ?? this.providerDetector.currentSyntaxMode();
    logger.debug("[QUERY]", "Translating filter to provider", { syntaxMode });

    switch (syntaxMode) {
      case "sql":
        return this.translateToSql(filter);
      case "mongodb":
        return this.translateToMongoDB(filter);
      case "json":
        return this.translateToJson(filter);
      case "keyvalue":
        return this.translateToKeyValue(filter);
      default:
        return this.translateToSql(filter);
    }
  }

  translateFromProvider(query: string, mode?: SyntaxMode): FilterExpression | null {
    const syntaxMode = mode ?? this.providerDetector.currentSyntaxMode();

    switch (syntaxMode) {
      case "sql":
        return this.parseSqlWhere(query);
      case "mongodb":
        return this.parseMongoDbFilter(query);
      case "json":
        return this.parseJsonFilter(query);
      default:
        return null;
    }
  }

  private translateToSql(filter: FilterExpression): TranslationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const sql = this.buildSqlWhere(filter);
      return { query: sql, errors, warnings };
    } catch (e) {
      return { query: "", errors: [(e as Error).message], warnings };
    }
  }

  private buildSqlWhere(filter: FilterExpression): string {
    if (!filter) return "";

    if (filter.and && filter.and.length > 0) {
      const conditions = filter.and.map((f) => this.buildSqlWhere(f)).filter(Boolean);
      return conditions.length > 1 ? `(${conditions.join(" AND ")})` : (conditions[0] ?? "");
    }

    if (filter.or && filter.or.length > 0) {
      const conditions = filter.or.map((f) => this.buildSqlWhere(f)).filter(Boolean);
      return conditions.length > 1 ? `(${conditions.join(" OR ")})` : (conditions[0] ?? "");
    }

    if (filter.not) {
      const inner = this.buildSqlWhere(filter.not);
      return inner ? `NOT (${inner})` : "";
    }

    if (filter.field && filter.operator) {
      return this.buildSqlCondition(filter.field, filter.operator, filter.value);
    }

    return "";
  }

  private buildSqlCondition(field: string, operator: FilterOperator, value: unknown): string {
    const escapedValue = this.escapeSqlValue(value);

    switch (operator) {
      case "eq":
        return value === null ? `${field} IS NULL` : `${field} = ${escapedValue}`;
      case "neq":
        return value === null ? `${field} IS NOT NULL` : `${field} <> ${escapedValue}`;
      case "gt":
        return `${field} > ${escapedValue}`;
      case "gte":
        return `${field} >= ${escapedValue}`;
      case "lt":
        return `${field} < ${escapedValue}`;
      case "lte":
        return `${field} <= ${escapedValue}`;
      case "contains":
        return `${field} ILIKE '%${value}%'`;
      case "startsWith":
        return `${field} ILIKE '${value}%'`;
      case "endsWith":
        return `${field} ILIKE '%${value}'`;
      case "like":
        return `${field} LIKE '${value}'`;
      case "isNull":
        return `${field} IS NULL`;
      case "isNotNull":
        return `${field} IS NOT NULL`;
      case "in":
        return Array.isArray(value)
          ? `${field} IN (${value.map((v) => this.escapeSqlValue(v)).join(", ")})`
          : "";
      case "notIn":
        return Array.isArray(value)
          ? `${field} NOT IN (${value.map((v) => this.escapeSqlValue(v)).join(", ")})`
          : "";
      case "between":
        if (Array.isArray(value) && value.length === 2) {
          return `${field} BETWEEN ${this.escapeSqlValue(value[0])} AND ${this.escapeSqlValue(value[1])}`;
        }
        return "";
      default:
        return `${field} = ${escapedValue}`;
    }
  }

  private escapeSqlValue(value: unknown): string {
    return escapeSqlValue(value);
  }

  private translateToMongoDB(filter: FilterExpression): TranslationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const mongoFilter = this.buildMongoFilter(filter);
      const jsonStr = JSON.stringify(mongoFilter, null, 2);
      return { query: jsonStr, errors, warnings };
    } catch (e) {
      return { query: "", errors: [(e as Error).message], warnings };
    }
  }

  private buildMongoFilter(filter: FilterExpression): Record<string, unknown> {
    if (!filter) return {};

    if (filter.and && filter.and.length > 0) {
      return { $and: filter.and.map((f) => this.buildMongoFilter(f)) };
    }

    if (filter.or && filter.or.length > 0) {
      return { $or: filter.or.map((f) => this.buildMongoFilter(f)) };
    }

    if (filter.not) {
      return { $not: this.buildMongoFilter(filter.not) };
    }

    if (filter.field && filter.operator) {
      return this.buildMongoCondition(filter.field, filter.operator, filter.value);
    }

    return {};
  }

  private buildMongoCondition(
    field: string,
    operator: FilterOperator,
    value: unknown
  ): Record<string, unknown> {
    const mongoOps: Record<FilterOperator, string> = {
      eq: "$eq",
      neq: "$ne",
      gt: "$gt",
      gte: "$gte",
      lt: "$lt",
      lte: "$lte",
      contains: "$regex",
      startsWith: "$regex",
      endsWith: "$regex",
      like: "$regex",
      isNull: "$exists",
      isNotNull: "$exists",
      in: "$in",
      notIn: "$nin",
      between: "$gte",
      and: "$and",
      or: "$or",
      not: "$not",
    };

    const mongoOp = mongoOps[operator];
    if (!mongoOp) return { [field]: value };

    switch (operator) {
      case "contains":
        return { [field]: { $regex: String(value), $options: "i" } };
      case "startsWith":
        return { [field]: { $regex: `^${this.escapeRegex(String(value))}`, $options: "i" } };
      case "endsWith":
        return { [field]: { $regex: `${this.escapeRegex(String(value))}$`, $options: "i" } };
      case "like":
        return {
          [field]: { $regex: this.escapeRegex(String(value).replace(/%/g, ".*")), $options: "i" },
        };
      case "isNull":
        return { [field]: { $exists: true, $eq: null } };
      case "isNotNull":
        return { [field]: { $exists: true, $ne: null } };
      case "between":
        if (Array.isArray(value) && value.length === 2) {
          return { [field]: { $gte: value[0], $lte: value[1] } };
        }
        return { [field]: value };
      default:
        return { [field]: { [mongoOp]: value } };
    }
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  private translateToJson(filter: FilterExpression): TranslationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const jsonFilter = this.buildJsonFilter(filter);
      const jsonStr = JSON.stringify(jsonFilter, null, 2);
      return { query: jsonStr, errors, warnings };
    } catch (e) {
      return { query: "", errors: [(e as Error).message], warnings };
    }
  }

  private buildJsonFilter(filter: FilterExpression): Record<string, unknown> {
    if (!filter) return {};

    if (filter.and && filter.and.length > 0) {
      return { $and: filter.and.map((f) => this.buildJsonFilter(f)) };
    }

    if (filter.or && filter.or.length > 0) {
      return { $or: filter.or.map((f) => this.buildJsonFilter(f)) };
    }

    if (filter.not) {
      return { $not: this.buildJsonFilter(filter.not) };
    }

    if (filter.field && filter.operator) {
      const cond: Record<string, unknown> = {};
      const opMap: Record<FilterOperator, string> = {
        eq: "$eq",
        neq: "$ne",
        gt: "$gt",
        gte: "$gte",
        lt: "$lt",
        lte: "$lte",
        contains: "$contains",
        startsWith: "$startsWith",
        endsWith: "$endsWith",
        like: "$like",
        isNull: "$isNull",
        isNotNull: "$isNotNull",
        in: "$in",
        notIn: "$notIn",
        between: "$between",
        and: "$and",
        or: "$or",
        not: "$not",
      };

      const op = opMap[filter.operator];
      if (filter.operator === "isNull") {
        cond[op] = true;
      } else if (filter.operator === "isNotNull") {
        cond[op] = false;
      } else if (filter.operator === "between" && Array.isArray(filter.value)) {
        cond[op] = filter.value;
      } else {
        cond[op] = filter.value;
      }

      return { [filter.field]: cond };
    }

    return {};
  }

  private translateToKeyValue(filter: FilterExpression): TranslationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (filter.field && filter.operator === "eq") {
      return { query: `${filter.field}:${filter.value}`, errors, warnings };
    }

    warnings.push("Key-value mode only supports simple equality filters");
    return { query: "*", errors, warnings };
  }

  private parseSqlWhere(sql: string): FilterExpression | null {
    try {
      const whereClause = sql.replace(/^\s*SELECT.*?\s+FROM\s+\S+(\s+WHERE)?/i, "").trim();
      if (!whereClause) return null;

      const filter = this.parseSqlExpression(whereClause);
      return filter;
    } catch {
      return null;
    }
  }

  private parseSqlExpression(sql: string): FilterExpression {
    let expr = sql.trim();

    if (expr.startsWith("(") && expr.endsWith(")")) {
      const inner = expr.slice(1, -1).trim();
      if (inner.toLowerCase().startsWith("select")) {
        expr = expr;
      } else {
        return this.parseSqlExpression(inner);
      }
    }

    const orMatch = this.splitByOperator(expr, " OR ");
    if (orMatch) {
      return {
        or: orMatch.map((part) => this.parseSqlExpression(part.trim())),
      };
    }

    const andMatch = this.splitByOperator(expr, " AND ");
    if (andMatch && andMatch.length > 1) {
      return {
        and: andMatch.map((part) => this.parseSqlExpression(part.trim())),
      };
    }

    const notMatch = expr.match(/^NOT\s+\((.+)\)$/i);
    if (notMatch) {
      return {
        not: this.parseSqlExpression(notMatch[1]),
      };
    }

    return this.parseSqlCondition(expr);
  }

  private splitByOperator(expr: string, operator: string): string[] | null {
    let depth = 0;
    let lastIndex = 0;
    const parts: string[] = [];
    const upperExpr = expr.toUpperCase();
    const opUpper = operator.toUpperCase();

    for (let i = 0; i < expr.length; i++) {
      if (expr[i] === "(") depth++;
      else if (expr[i] === ")") depth--;
      else if (depth === 0 && upperExpr.substring(i).startsWith(opUpper)) {
        const part = expr.substring(lastIndex, i).trim();
        if (part) parts.push(part);
        lastIndex = i + operator.length;
        i += operator.length - 1;
      }
    }

    const remaining = expr.substring(lastIndex).trim();
    if (remaining) parts.push(remaining);

    return parts.length > 1 ? parts : null;
  }

  private parseSqlCondition(sql: string): FilterExpression {
    const sqlConditionRegex =
      /^(\w+(?:\.\w+)?)\s+(IS\s+NULL|IS\s+NOT\s+NULL|=|!=|<>|<|>|LIKE|ILIKE|IN\s*\(|NOT\s+IN\s*\(|BETWEEN|>=|<=)\s*(.+)$/i;
    const match = sql.match(sqlConditionRegex);

    if (!match) {
      return { field: "_raw", operator: "eq", value: sql.trim() };
    }

    const [, field, opStr, valueStr] = match;
    const operator = this.mapSqlOperator(opStr.trim());

    if (["IS NULL", "IS NOT NULL"].includes(opStr.toUpperCase())) {
      return { field, operator, value: null };
    }

    if (opStr.toUpperCase().startsWith("IN")) {
      const values = valueStr
        .replace(/^\(|\)$/g, "")
        .split(",")
        .map((v) => v.trim());
      return { field, operator: "in", value: values };
    }

    if (opStr.toUpperCase() === "BETWEEN") {
      const betweenMatch = valueStr.match(/^(.+?)\s+AND\s+(.+)$/i);
      if (betweenMatch) {
        return {
          field,
          operator: "between",
          value: [betweenMatch[1].trim(), betweenMatch[2].trim()],
        };
      }
    }

    let value: unknown = valueStr.trim();
    if (value === "NULL") value = null;
    else if (!isNaN(Number(value))) value = Number(value);
    else if (value === "TRUE") value = true;
    else if (value === "FALSE") value = false;
    else if (typeof value === "string" && value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1).replace(/''/g, "'");
    }

    return { field, operator, value };
  }

  private mapSqlOperator(op: string): FilterOperator {
    const opUpper = op.toUpperCase();
    const mapping: Record<string, FilterOperator> = {
      "=": "eq",
      "!=": "neq",
      "<>": "neq",
      ">": "gt",
      ">=": "gte",
      "<": "lt",
      "<=": "lte",
      LIKE: "like",
      ILIKE: "like",
      "IS NULL": "isNull",
      "IS NOT NULL": "isNotNull",
      IN: "in",
      "NOT IN": "notIn",
      BETWEEN: "between",
    };
    return mapping[opUpper] ?? "eq";
  }

  private parseMongoDbFilter(json: string): FilterExpression | null {
    try {
      const parsed = JSON.parse(json);
      return this.convertMongoToFilter(parsed);
    } catch {
      return null;
    }
  }

  private convertMongoToFilter(obj: Record<string, unknown>): FilterExpression {
    const filter: FilterExpression = {};

    if (obj["$and"] && Array.isArray(obj["$and"])) {
      filter.and = (obj["$and"] as Record<string, unknown>[]).map((item) =>
        this.convertMongoToFilter(item)
      );
      return filter;
    }

    if (obj["$or"] && Array.isArray(obj["$or"])) {
      filter.or = (obj["$or"] as Record<string, unknown>[]).map((item) =>
        this.convertMongoToFilter(item)
      );
      return filter;
    }

    if (obj["$not"]) {
      filter.not = this.convertMongoToFilter(obj["$not"] as Record<string, unknown>);
      return filter;
    }

    for (const [key, value] of Object.entries(obj)) {
      if (key.startsWith("$")) continue;

      if (typeof value === "object" && value !== null) {
        const inner = value as Record<string, unknown>;
        for (const [op, opValue] of Object.entries(inner)) {
          const operator = this.mapMongoOperator(op);
          if (operator) {
            filter.field = key;
            filter.operator = operator;
            filter.value = opValue;
            break;
          }
        }
      } else {
        filter.field = key;
        filter.operator = "eq";
        filter.value = value;
      }
      break;
    }

    return filter;
  }

  private mapMongoOperator(op: string): FilterOperator | null {
    return (MONGO_OPERATOR_MAP[op] as FilterOperator) ?? null;
  }

  private parseJsonFilter(json: string): FilterExpression | null {
    try {
      const parsed = JSON.parse(json);
      return this.convertMongoToFilter(parsed);
    } catch {
      return null;
    }
  }
}
