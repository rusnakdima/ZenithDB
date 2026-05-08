import { Injectable } from "@angular/core";

@Injectable({ providedIn: "root" })
export class ConfirmService {
  confirmDelete(itemName: string): Promise<boolean> {
    return Promise.resolve(confirm(`Delete "${itemName}"? This action cannot be undone.`));
  }
}
