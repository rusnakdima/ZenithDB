import { Injectable, inject } from "@angular/core";
import { FilterExpression, FilterOperator } from "@shared/models/connection.config";
import { FilterBuilderService } from "./filter-builder.service";
import { ProviderDetectorService } from "./provider-detector.service";
import { MONGO_OPERATOR_MAP } from "@shared/utils/operator.utils";
import { AppLoggerService } from "@shared/services/app-logger.service";

export interface ValidationError {
  line: number;
  column: number;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

@Injectable({ providedIn: "root" })
export class QueryValidatorService {
  private readonly filterBuilder = inject(FilterBuilderService);
  private readonly providerDetector = inject(ProviderDetectorService);
  private readonly logger = inject(AppLoggerService);

  validateQuery(query: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    if (!query || query.trim().length === 0) {
      this.logger.debug("[QUERY]", "Empty query validation");
      return {
        isValid: false,
        errors: [{ line: 1, column: 1, message: "Query cannot be empty", severity: "error" }],
        warnings: [],
      };
    }

    this.logger.debug("[QUERY]", "Validating query", { queryLength: query.length });
    const syntaxMode = this.providerDetector.currentSyntaxMode();

    switch (syntaxMode) {
      case "sql":
        this.validateSql(query, errors, warnings);
        break;
      case "mongodb":
        this.validateMongoDB(query, errors, warnings);
        break;
      case "json":
        this.validateJson(query, errors, warnings);
        break;
      default:
        this.validateSql(query, errors, warnings);
    }

    return {
      isValid: errors.filter((e) => e.severity === "error").length === 0,
      errors: errors.filter((e) => e.severity === "error"),
      warnings: [...errors.filter((e) => e.severity === "warning"), ...warnings],
    };
  }

  validateFilter(filter: FilterExpression): ValidationResult {
    this.logger.debug("[QUERY]", "Validating filter expression");
    const result = this.filterBuilder.validateFilter(filter);
    return {
      isValid: result.isValid,
      errors: result.errors.map((msg) => ({
        line: 1,
        column: 1,
        message: msg,
        severity: "error" as const,
      })),
      warnings: result.warnings.map((msg) => ({
        line: 1,
        column: 1,
        message: msg,
        severity: "warning" as const,
      })),
    };
  }

  private validateSql(query: string, errors: ValidationError[], warnings: ValidationError[]): void {
    const sqlKeywords = ["SELECT", "INSERT", "UPDATE", "DELETE", "CREATE", "DROP", "ALTER"];
    const hasKeyword = sqlKeywords.some((kw) => query.toUpperCase().includes(kw));

    if (!hasKeyword && !query.toUpperCase().includes("WHERE")) {
      warnings.push({
        line: 1,
        column: 1,
        message: "Query does not appear to be a SELECT statement",
        severity: "warning",
      });
    }

    const unclosedParens = this.countUnclosedParens(query);
    if (unclosedParens !== 0) {
      errors.push({
        line: 1,
        column: 1,
        message: `Unbalanced parentheses: ${unclosedParens} ${unclosedParens > 0 ? "unclosed" : "extra closing"}`,
        severity: "error",
      });
    }

    const unclosedStrings = this.findUnclosedStrings(query);
    if (unclosedStrings.length > 0) {
      errors.push(
        ...unclosedStrings.map((pos) => ({
          line: this.findLineNumber(query, pos),
          column: this.findColumn(query, pos),
          message: "Unclosed string literal",
          severity: "error" as const,
        }))
      );
    }

    const invalidChars = this.findInvalidSqlChars(query);
    if (invalidChars.length > 0) {
      errors.push({
        line: 1,
        column: 1,
        message: `Invalid characters found: ${invalidChars.join(", ")}`,
        severity: "error",
      });
    }
  }

  private validateMongoDB(
    query: string,
    errors: ValidationError[],
    warnings: ValidationError[]
  ): void {
    try {
      const parsed = JSON.parse(query);

      if (typeof parsed !== "object" || parsed === null) {
        errors.push({
          line: 1,
          column: 1,
          message: "MongoDB filter must be an object",
          severity: "error",
        });
      }

      const validOps = [
        "$and",
        "$or",
        "$not",
        "$gt",
        "$gte",
        "$lt",
        "$lte",
        "$eq",
        "$ne",
        "$in",
        "$nin",
        "$exists",
        "$regex",
      ];
      const usedOps = this.extractMongoOperators(parsed);

      for (const op of usedOps) {
        if (!validOps.includes(op) && !op.startsWith("$")) {
          warnings.push({
            line: 1,
            column: 1,
            message: `Unknown operator "${op}"`,
            severity: "warning",
          });
        }
      }
    } catch (e) {
      errors.push({
        line: 1,
        column: 1,
        message: `Invalid JSON: ${(e as Error).message}`,
        severity: "error",
      });
    }
  }

  private validateJson(
    query: string,
    errors: ValidationError[],
    warnings: ValidationError[]
  ): void {
    try {
      const parsed = JSON.parse(query);

      if (typeof parsed !== "object") {
        errors.push({
          line: 1,
          column: 1,
          message: "Filter must be a JSON object",
          severity: "error",
        });
      }
    } catch (e) {
      errors.push({
        line: 1,
        column: 1,
        message: `Invalid JSON: ${(e as Error).message}`,
        severity: "error",
      });
    }
  }

  private countUnclosedParens(query: string): number {
    let count = 0;
    let inString = false;
    let escaped = false;

    for (const char of query) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === "'" || char === '"') {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === "(") count++;
        if (char === ")") count--;
      }
    }

    return count;
  }

  private findUnclosedStrings(query: string): number[] {
    const positions: number[] = [];
    let inString = false;
    let stringChar = "";
    let escaped = false;

    for (let i = 0; i < query.length; i++) {
      const char = query[i];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (!inString && (char === "'" || char === '"')) {
        inString = true;
        stringChar = char;
      } else if (inString && char === stringChar) {
        inString = false;
      }
    }

    if (inString) {
      positions.push(query.length);
    }

    return positions;
  }

  private findInvalidSqlChars(query: string): string[] {
    const invalid: string[] = [];
    const validPattern = /[a-zA-Z0-9_\s.,;'<>=!()+-]/;

    for (const char of query) {
      if (!validPattern.test(char) && char !== "\n" && char !== "\r" && char !== "\t") {
        if (!invalid.includes(char)) {
          invalid.push(char);
        }
      }
    }

    return invalid;
  }

  private extractMongoOperators(obj: unknown, path: string[] = []): string[] {
    const operators: string[] = [];

    if (typeof obj !== "object" || obj === null) return operators;

    if (Array.isArray(obj)) {
      for (const item of obj) {
        operators.push(...this.extractMongoOperators(item, path));
      }
    } else {
      for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        if (key.startsWith("$")) {
          operators.push(key);
        }
        operators.push(...this.extractMongoOperators(value, [...path, key]));
      }
    }

    return operators;
  }

  private findLineNumber(query: string, position: number): number {
    const lines = query.substring(0, position).split("\n");
    return lines.length;
  }

  private findColumn(query: string, position: number): number {
    const lastNewline = query.lastIndexOf("\n", position);
    return position - lastNewline;
  }

  parseQueryToFilter(query: string): FilterExpression | null {
    const syntaxMode = this.providerDetector.currentSyntaxMode();

    if (syntaxMode === "mongodb" || syntaxMode === "json") {
      try {
        const parsed = JSON.parse(query);
        return this.jsonToFilter(parsed);
      } catch {
        return null;
      }
    }

    return null;
  }

  private jsonToFilter(obj: Record<string, unknown>): FilterExpression | null {
    if (obj["$and"]) {
      return { and: obj["$and"] as FilterExpression[] };
    }
    if (obj["$or"]) {
      return { or: obj["$or"] as FilterExpression[] };
    }

    for (const [key, value] of Object.entries(obj)) {
      if (key.startsWith("$")) continue;

      if (typeof value === "object" && value !== null) {
        const inner = value as Record<string, unknown>;
        for (const [op, opValue] of Object.entries(inner)) {
          return {
            field: key,
            operator: this.mapOperator(op),
            value: opValue,
          };
        }
      }

      return { field: key, operator: "eq", value };
    }

    return null;
  }

  private mapOperator(op: string): FilterOperator {
    return (MONGO_OPERATOR_MAP[op] as FilterOperator) ?? "eq";
  }
}
