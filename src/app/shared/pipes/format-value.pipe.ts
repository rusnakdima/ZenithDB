import { Pipe, PipeTransform } from "@angular/core";

const cache = new WeakMap<object, string>();

@Pipe({ name: "formatValue", pure: true })
export class FormatValuePipe implements PipeTransform {
  transform(value: unknown): string {
    if (value === null || value === undefined) return "null";
    if (typeof value === "object") {
      const cached = cache.get(value as object);
      if (cached) return cached;
      let result: string;
      if (Array.isArray(value)) {
        result = `[${value.length} items]`;
      } else {
        const keys = Object.keys(value as object);
        result = keys.length <= 3 ? JSON.stringify(value) : `{${keys.length} keys}`;
      }
      cache.set(value as object, result);
      return result;
    }
    return String(value);
  }
}
