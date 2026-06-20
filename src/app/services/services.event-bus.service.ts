import { Injectable, signal } from "@angular/core";
export interface AppEvent {
  type: string;
  payload?: unknown;
  timestamp: Date;
}
type EventHandler = (event: AppEvent) => void;
@Injectable({ providedIn: "root" })
export class EventBusService {
  private handlers = new Map<string, Set<EventHandler>>();
  private eventsSignal = signal<AppEvent[]>([]);
  readonly events = this.eventsSignal.asReadonly();
  on(eventType: string, handler: EventHandler): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
    return () => {
      this.handlers.get(eventType)?.delete(handler);
    };
  }
  emit(eventType: string, payload?: unknown): void {
    const event: AppEvent = { type: eventType, payload, timestamp: new Date() };
    this.eventsSignal.update((events) => [event, ...events].slice(0, 100));
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.forEach((handler) => handler(event));
    }
  }
  once(eventType: string, handler: EventHandler): void {
    const wrapper: EventHandler = (event) => {
      handler(event);
      this.handlers.get(eventType)?.delete(wrapper);
    };
    this.on(eventType, wrapper);
  }
  clear(): void {
    this.handlers.clear();
    this.eventsSignal.set([]);
  }
}
