import { Component, input, output } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { RowData } from "@shared/models/connection.config";

@Component({
  selector: "app-json-document-item",
  standalone: true,
  imports: [MatIconModule],
  templateUrl: "./json-document-item.component.html",
})
export class JsonDocumentItemComponent {
  doc = input.required<RowData>();
  docIndex = input.required<number>();
  highlightedLines = input<{ num: number; html: string }[]>([]);
  json = input<string>("");

  copy = output<{ doc: RowData; docIndex: number }>();
  inspect = output<RowData>();

  copyRowJson() {
    this.copy.emit({ doc: this.doc(), docIndex: this.docIndex() });
  }

  openInspector() {
    this.inspect.emit(this.doc());
  }
}
