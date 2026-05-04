import { Component, signal, output, Input, HostListener, computed } from "@angular/core";
import { FormsModule } from "@angular/forms";

@Component({
  selector: "app-sql-editor",
  standalone: true,
  imports: [FormsModule],
  templateUrl: "./sql-editor.component.html",
})
export class SqlEditorComponent {
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
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      });
    }
  }
}
