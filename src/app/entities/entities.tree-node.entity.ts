import { CollectionMeta } from "./entities.connection.config";
export interface TreeNode {
  name: string;
  type: "database" | "collection" | "field" | "connection";
  expanded?: boolean;
  children?: TreeNode[];
  collection?: CollectionMeta;
  count?: number;
  fields?: FieldNode[];
  selected?: boolean;
  id?: string;
}
export interface FieldNode {
  name: string;
  dataType: string;
  nullable: boolean;
  isPrimaryKey: boolean;
}
