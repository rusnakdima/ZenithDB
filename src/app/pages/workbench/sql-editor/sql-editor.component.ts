import {
  Component,
  signal,
  output,
  Input,
  HostListener,
  computed,
  inject,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { CompletionService, CompletionItem } from "./completion.service";
import { CompletionPopupComponent } from "./completion-popup.component";
import { ConnectionStateService } from "@services/services.connection-state.service";
import { SchemaService } from "@services/services.schema.service";

@Component({
  selector: "app-sql-editor",
  standalone: true,
  imports: [FormsModule, CompletionPopupComponent],
  templateUrl: "./sql-editor.component.html",
})
export class SqlEditorComponent implements AfterViewInit, OnDestroy {
  private _query = signal("");
  private completionService = inject(CompletionService);
  private connectionState = inject(ConnectionStateService);
  private schemaService = inject(SchemaService);

  @ViewChild("editor") editorRef!: ElementRef<HTMLTextAreaElement>;

  get query() {
    return this._query();
  }
  @Input()
  set query(value: string) {
    this._query.set(value);
  }
  queryChange = output<string>();

  completionItems = signal<CompletionItem[]>([]);
  completionVisible = signal(false);
  completionPosition = signal({ top: 0, left: 0 });
  selectedCompletionIndex = signal(0);
  private collectionsLoaded = false;

  get lines() {
    return this._query().split("\n");
  }
  get lineCount() {
    return Math.max(1, this.lines.length);
  }

  ngAfterViewInit() {
    this.loadCollectionsIfNeeded();
  }

  ngOnDestroy() {}

  private async loadCollectionsIfNeeded() {
    if (this.collectionsLoaded) return;
    const connId = this.connectionState.activeConnectionId();
    if (connId) {
      await this.completionService.loadCollections();
      this.collectionsLoaded = true;
    }
  }

  onInput(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    const value = target.value;
    const cursorPos = target.selectionStart;

    this._query.set(value);
    this.queryChange.emit(value);

    this.updateCompletions(value, cursorPos);
  }

  private updateCompletions(query: string, cursorPos: number) {
    const items = this.completionService.getCompletions(query, cursorPos);

    if (items.length > 0) {
      this.completionItems.set(items);
      this.completionVisible.set(true);
      this.selectedCompletionIndex.set(0);
      this.updatePopupPosition(cursorPos);
    } else {
      this.completionVisible.set(false);
    }
  }

  private updatePopupPosition(cursorPos: number) {
    const textarea = this.editorRef?.nativeElement;
    if (!textarea) return;

    const textBeforeCursor = textarea.value.substring(0, cursorPos);
    const lines = textBeforeCursor.split("\n");
    const currentLineNum = lines.length;
    const currentLineText = lines[lines.length - 1];

    const lineHeight = 24;
    const charWidth = 8;
    const paddingLeft = 16;
    const paddingTop = 12;
    const gutterWidth = 50;

    const top = paddingTop + currentLineNum * lineHeight;
    const left = gutterWidth + paddingLeft + currentLineText.length * charWidth;

    this.completionPosition.set({ top, left });
  }

  onCompletionSelect(item: CompletionItem) {
    const textarea = this.editorRef?.nativeElement;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const value = textarea.value;
    const word = this.getCurrentWord(value, cursorPos);

    const newValue =
      value.substring(0, cursorPos - word.length) + item.insertText + value.substring(cursorPos);

    this._query.set(newValue);
    this.queryChange.emit(newValue);

    this.completionVisible.set(false);

    setTimeout(() => {
      const newCursorPos = cursorPos - word.length + item.insertText.length;
      textarea.selectionStart = textarea.selectionEnd = newCursorPos;
      textarea.focus();
    }, 0);
  }

  onCompletionClose() {
    this.completionVisible.set(false);
  }

  @HostListener("keydown", ["$event"])
  handleKeydown(event: KeyboardEvent) {
    if (event.key === "Tab" && this.completionVisible()) {
      event.preventDefault();
      const items = this.completionItems();
      if (items.length > 0) {
        const idx = this.selectedCompletionIndex();
        this.onCompletionSelect(items[idx]);
      }
      return;
    }

    if (event.key === "Escape" && this.completionVisible()) {
      event.preventDefault();
      this.completionVisible.set(false);
      return;
    }

    if (event.key === "Control " || (event.ctrlKey && event.key === " ")) {
      event.preventDefault();
      const textarea = this.editorRef?.nativeElement;
      if (textarea) {
        const items = this.completionService.getAllKeywords();
        this.completionItems.set(items.slice(0, 20));
        this.completionVisible.set(true);
        this.selectedCompletionIndex.set(0);
        this.updatePopupPosition(textarea.selectionStart);
      }
      return;
    }

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

  private getCurrentWord(text: string, cursor: number): string {
    let start = cursor;
    while (start > 0 && /[\w.]/.test(text[start - 1])) {
      start--;
    }
    return text.substring(start, cursor);
  }
}
