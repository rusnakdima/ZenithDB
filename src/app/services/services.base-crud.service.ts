import { Injectable, inject } from "@angular/core";
import { Observable, from } from "rxjs";
import { TauriBridgeService } from "@providers/providers.tauri-bridge.service";
@Injectable({ providedIn: "root" })
export abstract class BaseCrudService<T> {
  protected abstract entityName: string;
  protected tauriBridge = inject(TauriBridgeService);
  getAll(): Observable<T[]> {
    return from(this.tauriBridge.invoke<T[]>(`get_all_${this.entityName}`));
  }
  getById(id: string): Observable<T> {
    return from(this.tauriBridge.invoke<T>(`get_${this.entityName}_by_id`, { id }));
  }
  create(data: Partial<T>): Observable<T> {
    return from(this.tauriBridge.invoke<T>(`create_${this.entityName}`, { data }));
  }
  update(id: string, data: Partial<T>): Observable<T> {
    return from(this.tauriBridge.invoke<T>(`update_${this.entityName}`, { id, data }));
  }
  delete(id: string): Observable<void> {
    return from(this.tauriBridge.invoke<void>(`delete_${this.entityName}`, { id }));
  }
}
