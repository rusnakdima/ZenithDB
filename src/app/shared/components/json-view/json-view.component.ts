import { Component, input, output } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { RowData } from "@shared/models/connection.config";
import { JsonDocumentItemComponent } from "../json-document-item/json-document-item.component";

@Component({
  selector: "app-json-view",
  standalone: true,
  imports: [MatIconModule, JsonDocumentItemComponent],
  templateUrl: "./json-view.component.html",
})
export class JsonViewComponent {
  fullJsonData = input<RowData[]>([]);
  jsonLoading = input(false);
  jsonHasMore = input(false);
  jsonLoadingMore = input(false);
  jsonDocumentsMap = input<
    Map<number, { highlightedLines: { num: number; html: string }[]; json: string }>
  >(new Map());

  copyRowJson = output<{ doc: RowData; docIndex: number }>();
  openInspector = output<RowData>();
  loadMore = output<void>();
  copyJsonToClipboard = output<void>();

  trackByIndex = (index: number): number => index;

  getDocLines(index: number) {
    return this.jsonDocumentsMap().get(index);
  }

  onCopyRowJson(doc: RowData, docIndex: number) {
    this.copyRowJson.emit({ doc, docIndex });
  }

  onOpenInspector(doc: RowData) {
    this.openInspector.emit(doc);
  }

  onLoadMore() {
    this.loadMore.emit();
  }

  onCopyJsonToClipboard() {
    this.copyJsonToClipboard.emit();
  }

  onCopyFullJson() {
    const json = JSON.stringify(this.fullJsonData(), null, 2);
    this.copyJsonToClipboard.emit();
  }
}
