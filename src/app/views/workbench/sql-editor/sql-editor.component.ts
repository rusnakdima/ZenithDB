import { Component, signal, output, Input, HostListener, computed, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { LoggingService } from "@shared/services/logging.service";

@Component({
  selector: "app-sql-editor",
  standalone: true,
  imports: [FormsModule],
  templateUrl: "./sql-editor.component.html",
})
export class SqlEditorComponent {
  private logger = inject(LoggingService);
  private _query = signal("");

  get query() {
    return this._query();
  }

  @Input()
  set query(value: string) {
    this._query.set(value);
  }

  queryChange = output<string>();

  get lines() {
    return this._query().split("\n");
  }

  get lineCount() {
    return Math.max(1, this.lines.length);
  }

  onInput(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    this._query.set(target.value);
    this.queryChange.emit(target.value);
    this.logger.debug("[SQL_EDITOR]", "Query input changed", { length: target.value.length });
  }

  @HostListener("keydown", ["$event"])
  handleKeydown(event: KeyboardEvent) {
    if (event.key === "Tab") {
      event.preventDefault();
      const target = event.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const value = target.value;
      const newValue = value.substring(0, start) + "  " + value.substring(end);
      this._query.set(newValue);
      this.queryChange.emit(newValue);
      this.logger.debug("[SQL_EDITOR]", "Tab inserted at position", { start, end });
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      });
    }
  }
}
