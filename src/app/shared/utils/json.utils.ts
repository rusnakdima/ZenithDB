export function formatJsonLines(json: string): string[] {
  if (!json) return [];
  return json.split("\n");
}

export function highlightJsonLine(line: string): string {
  if (!line) return "";

  let result = line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  result = result.replace(/("([^"\\]|\\.)*")\s*:/g, '<span class="json-key">$1</span>:');
  result = result.replace(/:\s*("([^"\\]|\\.)*")/g, ': <span class="json-string">$1</span>');
  result = result.replace(/:\s*(true|false)/g, ': <span class="json-boolean">$1</span>');
  result = result.replace(/:\s*(null)/g, ': <span class="json-null">$1</span>');
  result = result.replace(
    /:\s*(-?\d+\.?\d*([eE][+-]?\d+)?)/g,
    ': <span class="json-number">$1</span>'
  );

  result = result.replace(/([{}\[\],])/g, '<span class="json-punctuation">$1</span>');

  return result;
}

export function safeJsonParse<T>(json: string, defaultValue: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return defaultValue;
  }
}
