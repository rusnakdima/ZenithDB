import {
  Component,
  input,
  output,
  signal,
  computed,
  HostListener,
  ElementRef,
  inject,
  OnDestroy,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { CompletionItem } from "./completion.service";

@Component({
  selector: "app-completion-popup",
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (isVisible()) {
      <div
        class="completion-popup"
        [style.top.px]="position().top"
        [style.left.px]="position().left"
      >
        <div class="completion-header">
          <span class="completion-hint">Press</span>
          <kbd>↑↓</kbd><span class="completion-hint">to navigate</span> <kbd>Tab</kbd
          ><span class="completion-hint">or</span><kbd>Enter</kbd
          ><span class="completion-hint">to insert</span> <kbd>Esc</kbd
          ><span class="completion-hint">to close</span>
        </div>
        <div class="completion-list">
          @for (item of items(); track item.label; let idx = $index) {
            <div
              class="completion-item"
              [class.selected]="idx === selectedIndex()"
              (click)="selectItem(item)"
              (mouseenter)="setSelectedIndex(idx)"
            >
              <span class="completion-icon" [class]="'icon-' + item.kind">
                @switch (item.kind) {
                  @case ("keyword") {
                    <span class="kw-icon">K</span>
                  }
                  @case ("function") {
                    <span class="fn-icon">f</span>
                  }
                  @case ("collection") {
                    <span class="col-icon">T</span>
                  }
                  @case ("operator") {
                    <span class="op-icon">O</span>
                  }
                }
              </span>
              <div class="completion-content">
                <span class="completion-label">{{ item.label }}</span>
                @if (item.detail) {
                  <span class="completion-detail">{{ item.detail }}</span>
                }
              </div>
              @if (item.documentation) {
                <span class="completion-doc">{{ item.documentation }}</span>
              }
            </div>
          } @empty {
            <div class="completion-empty">No suggestions</div>
          }
        </div>
      </div>
    }
  `,
  styles: [
    `
      .completion-popup {
        position: absolute;
        z-index: 1000;
        min-width: 320px;
        max-width: 500px;
        max-height: 300px;
        background: var(--bg-elevated, #1a1a2e);
        border: 1px solid var(--border-visible, rgba(255, 255, 255, 0.1));
        border-radius: 8px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }

      .completion-header {
        padding: 6px 10px;
        background: rgba(0, 0, 0, 0.2);
        border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.05));
        font-size: 10px;
        color: var(--text-muted, #888);
        display: flex;
        gap: 4px;
        align-items: center;
        flex-wrap: wrap;
      }

      kbd {
        background: var(--bg-header, #16162a);
        padding: 1px 5px;
        border-radius: 3px;
        font-family: monospace;
        font-size: 10px;
        border: 1px solid var(--border-visible, rgba(255, 255, 255, 0.1));
      }

      .completion-hint {
        margin: 0 2px;
      }

      .completion-list {
        overflow-y: auto;
        max-height: 260px;
      }

      .completion-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        cursor: pointer;
        transition: background 0.1s;
        border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.05));
      }

      .completion-item:last-child {
        border-bottom: none;
      }

      .completion-item:hover,
      .completion-item.selected {
        background: var(--accent, #ff6b35);
        background: linear-gradient(135deg, var(--accent, #ff6b35) 20%, transparent);
      }

      .completion-item.selected {
        background-color: rgba(255, 107, 53, 0.15);
      }

      .completion-icon {
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        font-size: 10px;
        font-weight: bold;
        flex-shrink: 0;
      }

      .icon-keyword .kw-icon {
        background: rgba(99, 102, 241, 0.3);
        color: #a5b4fc;
      }
      .icon-function .fn-icon {
        background: rgba(34, 197, 94, 0.3);
        color: #86efac;
      }
      .icon-collection .col-icon {
        background: rgba(251, 191, 36, 0.3);
        color: #fcd34d;
      }
      .icon-operator .op-icon {
        background: rgba(168, 85, 247, 0.3);
        color: #d8b4fe;
      }

      .completion-content {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 1px;
      }

      .completion-label {
        font-family: "Monaco", "Menlo", monospace;
        font-size: 13px;
        color: var(--text-main, #fff);
      }

      .completion-detail {
        font-size: 10px;
        color: var(--text-muted, #888);
      }

      .completion-doc {
        font-family: "Monaco", "Menlo", monospace;
        font-size: 10px;
        color: var(--text-dim, #666);
        max-width: 150px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .completion-empty {
        padding: 16px;
        text-align: center;
        color: var(--text-muted, #888);
        font-size: 12px;
      }
    `,
  ],
})
export class CompletionPopupComponent implements OnDestroy {
  items = input<CompletionItem[]>([]);
  position = input<{ top: number; left: number }>({ top: 0, left: 0 });
  isVisible = input<boolean>(false);

  select = output<CompletionItem>();
  close = output<void>();

  selectedIndex = signal(0);

  @HostListener("document:keydown", ["$event"])
  handleKeydown(event: KeyboardEvent) {
    if (!this.isVisible()) return;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        event.stopPropagation();
        this.selectedIndex.update((i) => Math.min(i + 1, this.items().length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        event.stopPropagation();
        this.selectedIndex.update((i) => Math.max(i - 1, 0));
        break;
      case "Tab":
      case "Enter":
        event.preventDefault();
        event.stopPropagation();
        const item = this.items()[this.selectedIndex()];
        if (item) this.selectItem(item);
        break;
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        this.close.emit();
        break;
    }
  }

  selectItem(item: CompletionItem) {
    this.select.emit(item);
  }

  setSelectedIndex(index: number) {
    this.selectedIndex.set(index);
  }

  ngOnDestroy() {
    this.close.emit();
  }
}
