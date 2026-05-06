import { Injectable } from "@angular/core";

type JsonHighlightClasses = {
  key?: string;
  string?: string;
  number?: string;
  boolean?: string;
  null?: string;
};

const DEFAULT_CLASSES: JsonHighlightClasses = {
  key: "json-key",
  string: "json-string",
  number: "json-number",
  boolean: "json-boolean",
  null: "json-null",
};

const TAILWIND_CLASSES: JsonHighlightClasses = {
  key: "json-key",
  string: "json-string",
  number: "json-number",
  boolean: "json-boolean",
  null: "json-null",
};

@Injectable({
  providedIn: "root",
})
export class JsonHighlighterService {
  highlight(json: string, classes: JsonHighlightClasses = DEFAULT_CLASSES): string {
    if (!json) return "";

    const escaped = json.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    return escaped.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      (match) => {
        let cls = classes.number ?? "json-number";
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = classes.key ?? "json-key";
          } else {
            cls = classes.string ?? "json-string";
          }
        } else if (/true|false/.test(match)) {
          cls = classes.boolean ?? "json-boolean";
        } else if (/null/.test(match)) {
          cls = classes.null ?? "json-null";
        }
        return `<span class="${cls}">${match}</span>`;
      }
    );
  }

  highlightJsonLine(line: string): string {
    return this.highlight(line, TAILWIND_CLASSES);
  }
}
