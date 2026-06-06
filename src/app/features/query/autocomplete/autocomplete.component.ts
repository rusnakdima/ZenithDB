import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
  inject,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { AutocompleteService, CompletionItem } from "../services";

@Component({
  selector: "app-autocomplete",
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (isActive()) {
      <div
        class="absolute z-50 overflow-hidden rounded-lg border border-slate-600 bg-slate-800 shadow-xl"
        [style.top.px]="position().top"
        [style.left.px]="position().left"
        [style.min-width.px]="minWidth"
      >
        <div class="max-h-64 overflow-y-auto">
          @for (item of items(); track item.label; let i = $index) {
            <div
              class="flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors"
              [class.bg-emerald-600]="i === selectedIndex()"
              [class.text-white]="i === selectedIndex()"
              [class.text-slate-300]="i !== selectedIndex()"
              [class.hover:bg-slate-700]="i !== selectedIndex()"
              (click)="onItemClick(item)"
              (mouseenter)="onMouseEnter(i)"
            >
              <!-- Icon -->
              <div class="flex h-5 w-5 items-center justify-center text-xs">
                @switch (item.kind) {
                  @case ("collection") {
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                      />
                    </svg>
                  }
                  @case ("field") {
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
                      />
                    </svg>
                  }
                  @case ("operator") {
                    <span class="font-mono text-xs text-amber-400">Op</span>
                  }
                  @case ("keyword") {
                    <span class="font-mono text-xs text-blue-400">Kw</span>
                  }
                  @default {
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                  }
                }
              </div>

              <!-- Label -->
              <span class="flex-1 truncate font-mono text-sm">{{ item.label }}</span>

              <!-- Detail -->
              @if (item.detail) {
                <span class="text-xs text-slate-400">{{ item.detail }}</span>
              }
            </div>
          } @empty {
            <div class="px-3 py-4 text-center text-sm text-slate-500">No suggestions available</div>
          }
        </div>

        <!-- Footer -->
        <div
          class="flex items-center justify-between border-t border-slate-700 bg-slate-800/80 px-3 py-2"
        >
          <div class="flex items-center gap-2 text-xs text-slate-500">
            <kbd class="rounded bg-slate-700 px-1.5 py-0.5 text-slate-400">↑↓</kbd>
            <span>Navigate</span>
            <kbd class="ml-2 rounded bg-slate-700 px-1.5 py-0.5 text-slate-400">Enter</kbd>
            <span>Select</span>
            <kbd class="ml-2 rounded bg-slate-700 px-1.5 py-0.5 text-slate-400">Esc</kbd>
            <span>Close</span>
          </div>
        </div>
      </div>
    }
  `,
})
export class AutocompleteComponent implements OnInit, OnDestroy {
  private readonly autocompleteService = inject(AutocompleteService);

  @Input() minWidth = 280;
  @Input() position = signal({ top: 0, left: 0 });

  @Output() itemSelect = new EventEmitter<CompletionItem>();
  @Output() close = new EventEmitter<void>();

  isActive = this.autocompleteService.isActive;
  items = this.autocompleteService.items;
  selectedIndex = this.autocompleteService.selectedIndex;

  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  ngOnInit(): void {
    this.keydownHandler = (e: KeyboardEvent) => this.handleKeydown(e);
    document.addEventListener("keydown", this.keydownHandler);
  }

  ngOnDestroy(): void {
    if (this.keydownHandler) {
      document.removeEventListener("keydown", this.keydownHandler);
    }
  }

  handleKeydown(e: KeyboardEvent): void {
    if (!this.isActive()) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        e.stopPropagation();
        this.autocompleteService.selectNext();
        break;
      case "ArrowUp":
        e.preventDefault();
        e.stopPropagation();
        this.autocompleteService.selectPrevious();
        break;
      case "Enter":
        e.preventDefault();
        e.stopPropagation();
        this.confirmSelection();
        break;
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        this.onClose();
        break;
    }
  }

  onItemClick(item: CompletionItem): void {
    this.itemSelect.emit(item);
    this.autocompleteService.close();
  }

  onMouseEnter(index: number): void {
    this.autocompleteService["selectedIndexSignal"].set(index);
  }

  private confirmSelection(): void {
    const item = this.autocompleteService.confirmSelection();
    if (item) {
      this.itemSelect.emit(item);
    }
  }

  onClose(): void {
    this.autocompleteService.close();
    this.close.emit();
  }
}
