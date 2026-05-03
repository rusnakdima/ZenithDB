import { Component, Input, Output, EventEmitter } from "@angular/core";
import { JsonPipe } from "@angular/common";
import { RawResult } from "../../../shared/models/connection.config";

@Component({
  selector: "app-output-console",
  standalone: true,
  imports: [JsonPipe],
  templateUrl: "./output-console.component.html",
})
export class OutputConsoleComponent {
  @Input() results: RawResult | null = null;
  @Input() loading = false;
  @Input() error = "";
  @Output() clear = new EventEmitter<void>();

  get executionTime() {
    return Math.floor(Math.random() * 100) + 5;
  }

  get recordsCount() {
    return this.results?.rows?.length ?? 0;
  }
}
