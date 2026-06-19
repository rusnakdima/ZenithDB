import { Injectable, signal, inject } from "@angular/core";
export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmClass?: string;
  itemName?: string;
}

@Injectable({ providedIn: "root" })
export class ConfirmService {
  private resolvePromise: ((value: boolean) => void) | null = null;
  isOpen = signal(false);
  options = signal<ConfirmOptions>({ message: "" });

  async confirmDelete(itemName: string): Promise<boolean> {
    return this.confirm({
      title: "Delete",
      message: `Are you sure you want to delete this? This action cannot be undone.`,
      itemName,
      confirmText: "Delete",
      confirmClass:
        "rounded-xl border border-[var(--accent)]/50 bg-transparent px-4 py-3 text-sm font-medium text-[var(--accent)] transition-colors hover:border-[var(--accent)]",
    });
  }

  async confirm(options: ConfirmOptions): Promise<boolean> {
    this.options.set(options);
    this.isOpen.set(true);
    return new Promise((resolve) => {
      this.resolvePromise = resolve;
    });
  }

  confirmResult(result: boolean): void {
    this.isOpen.set(false);
    this.resolvePromise?.(result);
    this.resolvePromise = null;
  }
}
