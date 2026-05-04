import {
  Directive,
  ElementRef,
  HostListener,
  inject,
  Input,
  Output,
  EventEmitter,
  signal,
} from "@angular/core";

@Directive({
  selector: "[appTableNavigation]",
  standalone: true,
})
export class TableNavigationDirective {
  @Input() rowCount = 0;
  @Input() colCount = 0;
  @Input() editingEnabled = true;
  @Output() cellChange = new EventEmitter<{ row: number; col: number }>();
  @Output() editConfirm = new EventEmitter<void>();
  @Output() editCancel = new EventEmitter<void>();
  @Output() deleteSelected = new EventEmitter<void>();

  private el = inject(ElementRef);

  currentRow = signal(0);
  currentCol = signal(0);
  isEditing = signal(false);

  @HostListener("keydown", ["$event"])
  onKeydown(event: KeyboardEvent): void {
    if (this.isEditing()) {
      this.handleEditingKey(event);
    } else {
      this.handleNavigationKey(event);
    }
  }

  private handleNavigationKey(event: KeyboardEvent): void {
    switch (event.key) {
      case "ArrowUp":
        event.preventDefault();
        this.moveVertical(-1);
        break;
      case "ArrowDown":
        event.preventDefault();
        this.moveVertical(1);
        break;
      case "ArrowLeft":
        event.preventDefault();
        this.moveHorizontal(-1);
        break;
      case "ArrowRight":
        event.preventDefault();
        this.moveHorizontal(1);
        break;
      case "Enter":
        if (this.editingEnabled) {
          event.preventDefault();
          this.startEditing();
        }
        break;
      case "Tab":
        event.preventDefault();
        if (event.shiftKey) {
          this.moveHorizontal(-1);
        } else {
          this.moveHorizontal(1);
        }
        break;
      case "Escape":
        event.preventDefault();
        this.cancelEditing();
        break;
      case "Delete":
        if (event.shiftKey || event.ctrlKey) {
          event.preventDefault();
          this.deleteSelected.emit();
        }
        break;
      default:
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
          event.preventDefault();
          this.selectAll();
        }
        break;
    }

    this.emitCellChange();
  }

  private handleEditingKey(event: KeyboardEvent): void {
    switch (event.key) {
      case "Enter":
        event.preventDefault();
        this.confirmEdit();
        break;
      case "Escape":
        event.preventDefault();
        this.cancelEditing();
        break;
      case "Tab":
        event.preventDefault();
        this.confirmEdit();
        if (event.shiftKey) {
          this.moveHorizontal(-1);
        } else {
          this.moveHorizontal(1);
        }
        this.startEditing();
        break;
    }
  }

  private moveVertical(delta: number): void {
    const newRow = Math.max(0, Math.min(this.rowCount - 1, this.currentRow() + delta));
    this.currentRow.set(newRow);
  }

  private moveHorizontal(delta: number): void {
    let newCol = this.currentCol() + delta;
    let newRow = this.currentRow();

    if (newCol < 0) {
      newCol = this.colCount - 1;
      newRow = Math.max(0, newRow - 1);
    } else if (newCol >= this.colCount) {
      newCol = 0;
      newRow = Math.min(this.rowCount - 1, newRow + 1);
    }

    this.currentCol.set(newCol);
    this.currentRow.set(newRow);
  }

  private startEditing(): void {
    this.isEditing.set(true);
  }

  private confirmEdit(): void {
    this.isEditing.set(false);
    this.editConfirm.emit();
  }

  private cancelEditing(): void {
    this.isEditing.set(false);
    this.editCancel.emit();
  }

  private selectAll(): void {
    document.dispatchEvent(new CustomEvent("zenith:select-all-rows"));
  }

  private emitCellChange(): void {
    this.cellChange.emit({
      row: this.currentRow(),
      col: this.currentCol(),
    });
  }

  setPosition(row: number, col: number): void {
    this.currentRow.set(Math.max(0, Math.min(row, this.rowCount - 1)));
    this.currentCol.set(Math.max(0, Math.min(col, this.colCount - 1)));
  }

  resetPosition(): void {
    this.currentRow.set(0);
    this.currentCol.set(0);
  }
}
