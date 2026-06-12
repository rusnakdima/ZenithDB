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
import { AppLoggerService } from "@shared/services/app-logger.service";

@Component({
  selector: "app-autocomplete",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./autocomplete.component.html",
})
export class AutocompleteComponent implements OnInit, OnDestroy {
  private readonly autocompleteService = inject(AutocompleteService);
  private readonly logger = inject(AppLoggerService);

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
    this.logger.debug("[QUERY_AUTOCOMPLETE]", "Item clicked", { label: item.label });
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
