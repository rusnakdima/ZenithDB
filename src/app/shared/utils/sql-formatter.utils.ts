export const SQL_KEYWORDS = [
  "SELECT",
  "FROM",
  "WHERE",
  "AND",
  "OR",
  "INSERT",
  "INTO",
  "VALUES",
  "UPDATE",
  "SET",
  "DELETE",
  "CREATE",
  "TABLE",
  "DROP",
  "ALTER",
  "JOIN",
  "LEFT",
  "RIGHT",
  "INNER",
  "OUTER",
  "ON",
  "GROUP BY",
  "ORDER BY",
  "HAVING",
  "LIMIT",
  "OFFSET",
  "AS",
  "DISTINCT",
  "UNION",
  "ALL",
];
export function formatSQLWithKeywords(sql: string, keywords: string[]): string {
  let result = sql;
  keywords.forEach((kw) => {
    const regex = new RegExp(`\\b${kw}\\b`, "gi");
    result = result.replace(regex, kw);
  });
  result = result
    .replace(/\s+/g, " ")
    .replace(/,\s*/g, ", ")
    .replace(/\(\s*/g, "(")
    .replace(/\s*\)/g, ")");
  return result;
}
export function formatSQL(sql: string): string {
  return formatSQLWithKeywords(sql, SQL_KEYWORDS);
}
