import { Injectable, signal, computed, Type } from "@angular/core";

export interface DialogConfig<T = unknown> {
  id: string;
  component: Type<T>;
  inputs?: Record<string, unknown>;
  outputs?: Record<string, (event: unknown) => void>;
  width?: string;
  closable?: boolean;
}

@Injectable({ providedIn: "root" })
export class DialogService {
  private dialogsSignal = signal<DialogConfig[]>([]);
  private counter = 0;

  readonly dialogs = computed(() => this.dialogsSignal());

  open(config: Omit<DialogConfig, "id">): string {
    const id = `dialog-${++this.counter}-${Date.now()}`;
    const dialog: DialogConfig = { ...config, id };
    this.dialogsSignal.update((d) => [...d, dialog]);
    return id;
  }

  close(id: string): void {
    this.dialogsSignal.update((d) => d.filter((dlg) => dlg.id !== id));
  }

  closeAll(): void {
    this.dialogsSignal.set([]);
  }
}
