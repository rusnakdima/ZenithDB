import { Injectable, signal, computed } from "@angular/core";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastAction {
  label: string;
  callback: () => void;
}

export interface ToastConfig {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration?: number;
  persistent?: boolean;
  action?: ToastAction;
  position?: ToastPosition;
}

export type ToastPosition = "top-right" | "top-left" | "bottom-right" | "bottom-left" | "top-center" | "bottom-center";

const DEFAULT_DURATIONS: Record<ToastType, number> = {
  success: 3000,
  error: 5000,
  warning: 4000,
  info: 3000,
};

@Injectable({
  providedIn: "root",
})
export class ToastService {
  private toastsSignal = signal<ToastConfig[]>([]);
  private counter = 0;

  readonly toasts = computed(() => this.toastsSignal());

  private generateId(): string {
    return `toast-${++this.counter}-${Date.now()}`;
  }

  show(options: Omit<ToastConfig, "id"> & { id?: string }): string {
    const id = options.id ?? this.generateId();
    const type = options.type;
    const duration = options.duration ?? DEFAULT_DURATIONS[type];
    const persistent = options.persistent ?? false;

    const toast: ToastConfig = {
      ...options,
      id,
      type,
      duration,
      persistent,
    };

    this.toastsSignal.update((toasts) => {
      const updated = [toast, ...toasts];
      return updated.slice(0, 20);
    });

    if (!persistent && duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }

    return id;
  }

  success(message: string, options?: Partial<Omit<ToastConfig, "id" | "type" | "message">>): string {
    return this.show({ ...options, type: "success", message });
  }

  error(message: string, options?: Partial<Omit<ToastConfig, "id" | "type" | "message">>): string {
    return this.show({ ...options, type: "error", message });
  }

  warning(message: string, options?: Partial<Omit<ToastConfig, "id" | "type" | "message">>): string {
    return this.show({ ...options, type: "warning", message });
  }

  info(message: string, options?: Partial<Omit<ToastConfig, "id" | "type" | "message">>): string {
    return this.show({ ...options, type: "info", message });
  }

  dismiss(id: string): void {
    this.toastsSignal.update((toasts) => toasts.filter((t) => t.id !== id));
  }

  dismissAll(): void {
    this.toastsSignal.set([]);
  }

  update(id: string, changes: Partial<Pick<ToastConfig, "message" | "title" | "type" | "duration" | "persistent" | "action">>): void {
    this.toastsSignal.update((toasts) =>
      toasts.map((t) => (t.id === id ? { ...t, ...changes } : t))
    );
  }
}