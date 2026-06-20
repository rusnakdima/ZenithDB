import { FilterOperator } from "@entities/entities.connection.config";
import { ProviderType } from "./provider-info.entity";
export type TemplateCategory = "search" | "modify" | "aggregate" | "admin";
export type TemplateVariableType = "string" | "number" | "select" | "boolean";
export interface TemplateVariable {
  name: string;
  label: string;
  placeholder?: string;
  type: TemplateVariableType;
  options?: string[];
  required: boolean;
  defaultValue?: unknown;
  description?: string;
}
export interface QueryTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  providerTypes: ProviderType[];
  filterTemplate: QueryTemplateFilter;
  variables: TemplateVariable[];
  icon: string;
  isFavorite: boolean;
  isBuiltIn: boolean;
  keywords?: string[];
}
export interface QueryTemplateFilter {
  operator: "and" | "or";
  conditions: QueryTemplateCondition[];
  groups?: QueryTemplateFilter[];
}
export interface QueryTemplateCondition {
  field?: string;
  operator?: FilterOperator;
  value?: unknown;
  variable?: string;
}
export const TEMPLATE_CATEGORIES: Record<
  TemplateCategory,
  { label: string; icon: string; color: string }
> = {
  search: { label: "Search", icon: "search", color: "text-blue-500" },
  modify: { label: "Modify", icon: "edit", color: "text-amber-500" },
  aggregate: { label: "Aggregate", icon: "analytics", color: "text-purple-500" },
  admin: { label: "Admin", icon: "settings", color: "text-slate-500" },
};
