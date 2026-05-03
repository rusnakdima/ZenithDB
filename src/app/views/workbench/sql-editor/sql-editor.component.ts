import { Component, signal, output, Input, Output } from "@angular/core";
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

  onInput(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    this._query.set(target.value);
    this.queryChange.emit(target.value);
  }
}
