import { Component, input, output, signal, computed, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatIconModule } from "@angular/material/icon";
import { CheckboxComponent } from "@shared/components/checkbox/checkbox.component";
import { ToastService } from "@services/toast.service";
import { getLoggingService } from "@tauri-apps/logger";

@Component({
  selector: "app-database-selector",
  standalone: true,
  imports: [FormsModule, MatIconModule],
  templateUrl: "./database-selector.component.html",
})
export class DatabaseSelectorComponent {
  private toast = inject(ToastService);
  private logger = getLoggingService();

  provider = input.required<string>();
  uri = input.required<string>();
  selectedDatabases = input<string[]>([]);

  databasesChange = output<string[]>();

  editingDb = signal<string | null>(null);
  editDbName = "";
  manualDatabase = "";

  startEdit(dbName: string) {
    this.editingDb.set(dbName);
    this.editDbName = dbName;
    this.logger.debug("[DATABASE_SELECTOR]", "Started editing database", { dbName });
  }

  saveEdit() {
    const oldName = this.editingDb();
    if (!oldName) return;

    const newName = this.editDbName.trim();
    if (!newName || newName === oldName) {
      this.cancelEdit();
      return;
    }

    if (this.selectedDatabases().includes(newName)) {
      this.logger.warn("[DATABASE_SELECTOR]", "Duplicate database name", { newName });
      this.cancelEdit();
      return;
    }

    this.logger.info("[DATABASE_SELECTOR]", "Database renamed", { oldName, newName });
    this.databasesChange.emit(this.selectedDatabases().map((d) => (d === oldName ? newName : d)));
    this.cancelEdit();
  }

  cancelEdit() {
    this.editingDb.set(null);
    this.editDbName = "";
  }

  remove(dbName: string) {
    this.logger.info("[DATABASE_SELECTOR]", "Database removed", { dbName });
    this.databasesChange.emit(this.selectedDatabases().filter((d) => d !== dbName));
  }

  addManual() {
    const name = this.manualDatabase.trim();
    if (name && !this.selectedDatabases().includes(name)) {
      this.logger.info("[DATABASE_SELECTOR]", "Manual database added", { name });
      this.databasesChange.emit([...this.selectedDatabases(), name]);
    }
    this.manualDatabase = "";
  }
}
