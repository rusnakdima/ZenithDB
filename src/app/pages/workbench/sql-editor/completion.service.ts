import { Injectable, inject, signal } from "@angular/core";
import { SchemaService } from "@services/services.schema.service";
import { ConnectionStateService } from "@services/services.connection-state.service";

export interface CompletionItem {
  label: string;
  kind: "keyword" | "collection" | "function" | "operator";
  insertText: string;
  detail?: string;
  documentation?: string;
}

const SQL_KEYWORDS: CompletionItem[] = [
  {
    label: "SELECT",
    kind: "keyword",
    insertText: "SELECT ",
    detail: "Select columns",
    documentation: "SELECT column1, column2 FROM table",
  },
  {
    label: "FROM",
    kind: "keyword",
    insertText: "FROM ",
    detail: "Specify table",
    documentation: "SELECT * FROM table_name",
  },
  {
    label: "WHERE",
    kind: "keyword",
    insertText: "WHERE ",
    detail: "Filter conditions",
    documentation: "WHERE condition AND/OR condition",
  },
  {
    label: "JOIN",
    kind: "keyword",
    insertText: "JOIN ",
    detail: "Join tables",
    documentation: "INNER JOIN table ON condition",
  },
  {
    label: "LEFT JOIN",
    kind: "keyword",
    insertText: "LEFT JOIN ",
    detail: "Left outer join",
    documentation: "LEFT JOIN table ON condition",
  },
  {
    label: "RIGHT JOIN",
    kind: "keyword",
    insertText: "RIGHT JOIN ",
    detail: "Right outer join",
    documentation: "RIGHT JOIN table ON condition",
  },
  {
    label: "INNER JOIN",
    kind: "keyword",
    insertText: "INNER JOIN ",
    detail: "Inner join",
    documentation: "INNER JOIN table ON condition",
  },
  {
    label: "ORDER BY",
    kind: "keyword",
    insertText: "ORDER BY ",
    detail: "Sort results",
    documentation: "ORDER BY column ASC/DESC",
  },
  {
    label: "GROUP BY",
    kind: "keyword",
    insertText: "GROUP BY ",
    detail: "Group results",
    documentation: "GROUP BY column",
  },
  {
    label: "HAVING",
    kind: "keyword",
    insertText: "HAVING ",
    detail: "Filter grouped results",
    documentation: "HAVING aggregate > value",
  },
  {
    label: "LIMIT",
    kind: "keyword",
    insertText: "LIMIT ",
    detail: "Limit results",
    documentation: "LIMIT 10 OFFSET 0",
  },
  {
    label: "OFFSET",
    kind: "keyword",
    insertText: "OFFSET ",
    detail: "Skip rows",
    documentation: "LIMIT 10 OFFSET 5",
  },
  {
    label: "INSERT INTO",
    kind: "keyword",
    insertText: "INSERT INTO ",
    detail: "Insert rows",
    documentation: "INSERT INTO table (col) VALUES (val)",
  },
  {
    label: "VALUES",
    kind: "keyword",
    insertText: "VALUES ",
    detail: "Values to insert",
    documentation: "VALUES (val1), (val2)",
  },
  {
    label: "UPDATE",
    kind: "keyword",
    insertText: "UPDATE ",
    detail: "Update rows",
    documentation: "UPDATE table SET col = val WHERE condition",
  },
  {
    label: "SET",
    kind: "keyword",
    insertText: "SET ",
    detail: "Set values",
    documentation: "SET column = value",
  },
  {
    label: "DELETE FROM",
    kind: "keyword",
    insertText: "DELETE FROM ",
    detail: "Delete rows",
    documentation: "DELETE FROM table WHERE condition",
  },
  {
    label: "CREATE TABLE",
    kind: "keyword",
    insertText: "CREATE TABLE ",
    detail: "Create new table",
    documentation: "CREATE TABLE name (col TYPE, ...)",
  },
  {
    label: "DROP TABLE",
    kind: "keyword",
    insertText: "DROP TABLE ",
    detail: "Drop table",
    documentation: "DROP TABLE table_name",
  },
  {
    label: "ALTER TABLE",
    kind: "keyword",
    insertText: "ALTER TABLE ",
    detail: "Alter table",
    documentation: "ALTER TABLE name ADD col TYPE",
  },
  {
    label: "AS",
    kind: "keyword",
    insertText: "AS ",
    detail: "Alias",
    documentation: "SELECT col AS alias FROM table",
  },
  {
    label: "DISTINCT",
    kind: "keyword",
    insertText: "DISTINCT ",
    detail: "Unique values",
    documentation: "SELECT DISTINCT column FROM table",
  },
  {
    label: "COUNT",
    kind: "function",
    insertText: "COUNT(",
    detail: "Count rows",
    documentation: "COUNT(column)",
  },
  {
    label: "SUM",
    kind: "function",
    insertText: "SUM(",
    detail: "Sum values",
    documentation: "SUM(column)",
  },
  {
    label: "AVG",
    kind: "function",
    insertText: "AVG(",
    detail: "Average values",
    documentation: "AVG(column)",
  },
  {
    label: "MIN",
    kind: "function",
    insertText: "MIN(",
    detail: "Minimum value",
    documentation: "MIN(column)",
  },
  {
    label: "MAX",
    kind: "function",
    insertText: "MAX(",
    detail: "Maximum value",
    documentation: "MAX(column)",
  },
  {
    label: "AND",
    kind: "operator",
    insertText: "AND ",
    detail: "Logical AND",
    documentation: "condition1 AND condition2",
  },
  {
    label: "OR",
    kind: "operator",
    insertText: "OR ",
    detail: "Logical OR",
    documentation: "condition1 OR condition2",
  },
  {
    label: "NOT",
    kind: "operator",
    insertText: "NOT ",
    detail: "Logical NOT",
    documentation: "NOT condition",
  },
  {
    label: "IN",
    kind: "operator",
    insertText: "IN (",
    detail: "In list",
    documentation: "column IN (val1, val2)",
  },
  {
    label: "LIKE",
    kind: "operator",
    insertText: "LIKE ",
    detail: "Pattern match",
    documentation: "column LIKE '%pattern%'",
  },
  {
    label: "BETWEEN",
    kind: "operator",
    insertText: "BETWEEN ",
    detail: "Range check",
    documentation: "column BETWEEN val1 AND val2",
  },
  {
    label: "IS NULL",
    kind: "operator",
    insertText: "IS NULL",
    detail: "Null check",
    documentation: "column IS NULL",
  },
  {
    label: "IS NOT NULL",
    kind: "operator",
    insertText: "IS NOT NULL",
    detail: "Not null check",
    documentation: "column IS NOT NULL",
  },
  {
    label: "ASC",
    kind: "keyword",
    insertText: "ASC",
    detail: "Ascending order",
    documentation: "ORDER BY col ASC",
  },
  {
    label: "DESC",
    kind: "keyword",
    insertText: "DESC",
    detail: "Descending order",
    documentation: "ORDER BY col DESC",
  },
  {
    label: "TRUE",
    kind: "keyword",
    insertText: "TRUE",
    detail: "Boolean true",
    documentation: "WHERE active = TRUE",
  },
  {
    label: "FALSE",
    kind: "keyword",
    insertText: "FALSE",
    detail: "Boolean false",
    documentation: "WHERE active = FALSE",
  },
];

const MONGO_KEYWORDS: CompletionItem[] = [
  {
    label: "db",
    kind: "keyword",
    insertText: "db.",
    detail: "Database reference",
    documentation: "db.collection.find()",
  },
  {
    label: "find()",
    kind: "function",
    insertText: "find()",
    detail: "Query documents",
    documentation: "db.collection.find({ query })",
  },
  {
    label: "findOne()",
    kind: "function",
    insertText: "findOne()",
    detail: "Find single document",
    documentation: "db.collection.findOne({ query })",
  },
  {
    label: "insertOne()",
    kind: "function",
    insertText: "insertOne({ ",
    detail: "Insert single document",
    documentation: "db.collection.insertOne({ doc })",
  },
  {
    label: "insertMany()",
    kind: "function",
    insertText: "insertMany([",
    detail: "Insert multiple documents",
    documentation: "db.collection.insertMany([{ doc1 }, { doc2 }])",
  },
  {
    label: "updateOne()",
    kind: "function",
    insertText: "updateOne({ }, { ",
    detail: "Update single document",
    documentation: "db.collection.updateOne({ filter }, { $set: { field: value } })",
  },
  {
    label: "updateMany()",
    kind: "function",
    insertText: "updateMany({ }, { ",
    detail: "Update multiple documents",
    documentation: "db.collection.updateMany({ filter }, { $set: { field: value } })",
  },
  {
    label: "deleteOne()",
    kind: "function",
    insertText: "deleteOne({ ",
    detail: "Delete single document",
    documentation: "db.collection.deleteOne({ filter })",
  },
  {
    label: "deleteMany()",
    kind: "function",
    insertText: "deleteMany({ ",
    detail: "Delete multiple documents",
    documentation: "db.collection.deleteMany({ filter })",
  },
  {
    label: "countDocuments()",
    kind: "function",
    insertText: "countDocuments({ ",
    detail: "Count matching documents",
    documentation: "db.collection.countDocuments({ query })",
  },
  {
    label: "aggregate()",
    kind: "function",
    insertText: "aggregate([",
    detail: "Aggregation pipeline",
    documentation: "db.collection.aggregate([{ $match: {} }])",
  },
  {
    label: "distinct()",
    kind: "function",
    insertText: "distinct(",
    detail: "Distinct values",
    documentation: "db.collection.distinct('field', { query })",
  },
  {
    label: "createIndex()",
    kind: "function",
    insertText: "createIndex({ ",
    detail: "Create index",
    documentation: "db.collection.createIndex({ field: 1 })",
  },
  {
    label: "$set",
    kind: "operator",
    insertText: "$set: { ",
    detail: "Update fields",
    documentation: "{ $set: { field: value } }",
  },
  {
    label: "$unset",
    kind: "operator",
    insertText: "$unset: { ",
    detail: "Remove fields",
    documentation: "{ $unset: { field: 1 } }",
  },
  {
    label: "$inc",
    kind: "operator",
    insertText: "$inc: { ",
    detail: "Increment field",
    documentation: "{ $inc: { field: 1 } }",
  },
  {
    label: "$push",
    kind: "operator",
    insertText: "$push: { ",
    detail: "Push to array",
    documentation: "{ $push: { array: value } }",
  },
  {
    label: "$pull",
    kind: "operator",
    insertText: "$pull: { ",
    detail: "Pull from array",
    documentation: "{ $pull: { array: value } }",
  },
  {
    label: "$match",
    kind: "operator",
    insertText: "$match: { ",
    detail: "Match stage",
    documentation: "{ $match: { field: value } }",
  },
  {
    label: "$group",
    kind: "operator",
    insertText: "$group: { ",
    detail: "Group stage",
    documentation: "{ $group: { _id: '$field', total: { $sum: 1 } } }",
  },
  {
    label: "$project",
    kind: "operator",
    insertText: "$project: { ",
    detail: "Project stage",
    documentation: "{ $project: { field: 1, newField: 1 } }",
  },
  {
    label: "$sort",
    kind: "operator",
    insertText: "$sort: { ",
    detail: "Sort stage",
    documentation: "{ $sort: { field: 1 } }",
  },
  {
    label: "$limit",
    kind: "operator",
    insertText: "$limit: ",
    detail: "Limit stage",
    documentation: "{ $limit: 10 }",
  },
  {
    label: "$skip",
    kind: "operator",
    insertText: "$skip: ",
    detail: "Skip stage",
    documentation: "{ $skip: 5 }",
  },
];

@Injectable({ providedIn: "root" })
export class CompletionService {
  private schemaService = inject(SchemaService);
  private connectionState = inject(ConnectionStateService);

  private collectionsSignal = signal<string[]>([]);

  async loadCollections(): Promise<void> {
    const connId = this.connectionState.activeConnectionId();
    if (!connId) return;
    try {
      const collections = await this.schemaService.listCollections(connId);
      this.collectionsSignal.set(collections.map((c) => c.name));
    } catch {
      this.collectionsSignal.set([]);
    }
  }

  getCompletions(query: string, cursor: number): CompletionItem[] {
    const word = this.getCurrentWord(query, cursor);
    if (!word || word.length < 1) return [];

    const lowerWord = word.toLowerCase();
    const items: CompletionItem[] = [];

    items.push(...SQL_KEYWORDS.filter((k) => k.label.toLowerCase().startsWith(lowerWord)));

    items.push(...MONGO_KEYWORDS.filter((k) => k.label.toLowerCase().startsWith(lowerWord)));

    const collections = this.collectionsSignal();
    items.push(
      ...collections
        .map((name) => ({
          label: name,
          kind: "collection" as const,
          insertText: name,
          detail: "Collection",
        }))
        .filter((c) => c.label.toLowerCase().startsWith(lowerWord))
    );

    return items;
  }

  getAllKeywords(): CompletionItem[] {
    return [...SQL_KEYWORDS, ...MONGO_KEYWORDS];
  }

  private getCurrentWord(query: string, cursor: number): string {
    let start = cursor;
    while (start > 0 && /[\w.]/.test(query[start - 1])) {
      start--;
    }
    return query.slice(start, cursor);
  }

  getQueryContext(query: string, cursor: number): { before: string; after: string; word: string } {
    const word = this.getCurrentWord(query, cursor);
    let lineStart = cursor - word.length;
    while (lineStart > 0 && query[lineStart - 1] !== "\n") {
      lineStart--;
    }
    let lineEnd = cursor;
    while (lineEnd < query.length && query[lineEnd] !== "\n") {
      lineEnd++;
    }
    return {
      before: query.slice(lineStart, cursor - word.length),
      after: query.slice(cursor),
      word,
    };
  }
}
