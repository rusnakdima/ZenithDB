import {
  Component,
  input,
  output,
  signal,
  ElementRef,
  OnInit,
  OnDestroy,
  HostListener,
  inject,
} from "@angular/core";
import { CommonModule } from "@angular/common";

export type ModalSize = "sm" | "md" | "lg" | "xl" | "full";

@Component({
  selector: "app-modal",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./modal.component.html",
})
export class ModalComponent implements OnInit, OnDestroy {
  open = input<boolean>(false);
  title = input<string>("");
  size = input<ModalSize>("md");
  closeOnBackdrop = input<boolean>(true);
  closeOnEscape = input<boolean>(true);
  showCloseButton = input<boolean>(true);

  closed = output<void>();
  opened = output<void>();

  isVisible = signal(false);
  isAnimating = signal(false);

  private elementRef = inject(ElementRef);
  private previousActiveElement: HTMLElement | null = null;
  private escapeKeyHandler = (event: KeyboardEvent) => {
    if (event.key === "Escape" && this.closeOnEscape() && this.open()) {
      this.onClose();
    }
  };

  ngOnInit(): void {
    if (this.open()) {
      this.openModal();
    }
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  ngOnChanges(): void {
    if (this.open()) {
      this.openModal();
    } else {
      this.closeModal();
    }
  }

  @HostListener("document:keydown.escape")
  onEscapeKey(): void {
    if (this.closeOnEscape() && this.open()) {
      this.onClose();
    }
  }

  openModal(): void {
    this.previousActiveElement = document.activeElement as HTMLElement;
    this.isVisible.set(true);
    this.isAnimating.set(true);
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", this.escapeKeyHandler);

    setTimeout(() => {
      this.isAnimating.set(false);
      this.opened.emit();
      this.trapFocus();
    }, 50);
  }

  closeModal(): void {
    this.isAnimating.set(true);
    document.body.style.overflow = "";
    document.removeEventListener("keydown", this.escapeKeyHandler);

    setTimeout(() => {
      this.isVisible.set(false);
      this.isAnimating.set(false);
      this.closed.emit();
      this.restoreFocus();
    }, 200);
  }

  onBackdropClick(event: MouseEvent): void {
    if (this.closeOnBackdrop() && (event.target as HTMLElement).classList.contains("modal-backdrop")) {
      this.onClose();
    }
  }

  onClose(): void {
    this.closeModal();
  }

  get sizeClasses(): string {
    const sizes: Record<ModalSize, string> = {
      sm: "max-w-[400px]",
      md: "max-w-[600px]",
      lg: "max-w-[800px]",
      xl: "max-w-[1000px]",
      full: "max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)]",
    };
    return sizes[this.size()];
  }

  private trapFocus(): void {
    const focusableElements = this.elementRef.nativeElement.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusableElements.length > 0) {
      (focusableElements[0] as HTMLElement).focus();
    }
  }

  private restoreFocus(): void {
    if (this.previousActiveElement) {
      this.previousActiveElement.focus();
      this.previousActiveElement = null;
    }
  }

  private cleanup(): void {
    document.body.style.overflow = "";
    document.removeEventListener("keydown", this.escapeKeyHandler);
  }
}
