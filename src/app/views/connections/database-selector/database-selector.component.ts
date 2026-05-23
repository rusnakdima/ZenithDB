import { Component, input, output, signal, computed, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatIconModule } from "@angular/material/icon";
import { CheckboxComponent } from "@shared/components/checkbox/checkbox.component";
import { ToastService } from "@services/toast.service";

@Component({
  selector: "app-database-selector",
  standalone: true,
  imports: [FormsModule, MatIconModule],
  template: `
    <div class="space-y-4">
      <p class="text-sm text-[var(--text-dim)]">
        You can add databases manually after creating the connection.
      </p>
    </div>

    <div class="mt-4">
      <label class="form-label">Selected Databases</label>
      <div class="space-y-2">
        @for (db of selectedDatabases(); track db) {
          <div
            class="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2"
          >
            @if (editingDb() === db) {
              <input
                type="text"
                [(ngModel)]="editDbName"
                class="form-input flex-1"
                (keyup.enter)="saveEdit()"
                (keyup.escape)="cancelEdit()"
              />
              <button
                type="button"
                (click)="saveEdit()"
                class="rounded p-1 text-[var(--accent)] hover:bg-[var(--bg-card)]"
              >
                <mat-icon fontIcon="check" class="h-6! w-5! text-xl!" />
              </button>
              <button
                type="button"
                (click)="cancelEdit()"
                class="rounded p-1 text-[var(--text-dim)] hover:bg-[var(--bg-card)]"
              >
                <mat-icon fontIcon="close" class="h-6! w-5! text-xl!" />
              </button>
            } @else {
              <span class="flex-1 text-sm text-[var(--text-main)]">{{ db }}</span>
              <button
                type="button"
                (click)="startEdit(db)"
                class="rounded p-1 text-[var(--text-dim)] hover:text-[var(--accent)]"
              >
                <mat-icon fontIcon="edit" class="h-5! w-5! text-xl!" />
              </button>
              <button
                type="button"
                (click)="remove(db)"
                class="rounded p-1 text-[var(--text-dim)] hover:text-red-400"
              >
                <mat-icon fontIcon="delete" class="h-5! w-5! text-xl!" />
              </button>
            }
          </div>
        }
      </div>
    </div>

    <div class="mt-3 flex gap-2">
      <input
        type="text"
        [(ngModel)]="manualDatabase"
        placeholder="Enter database name"
        class="form-input flex-1"
      />
      <button type="button" (click)="addManual()" class="form-btn form-btn-secondary">Add</button>
    </div>
  `,
})
export class DatabaseSelectorComponent {
  private toast = inject(ToastService);

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
      this.cancelEdit();
      return;
    }

    this.databasesChange.emit(this.selectedDatabases().map((d) => (d === oldName ? newName : d)));
    this.cancelEdit();
  }

  cancelEdit() {
    this.editingDb.set(null);
    this.editDbName = "";
  }

  remove(dbName: string) {
    this.databasesChange.emit(this.selectedDatabases().filter((d) => d !== dbName));
  }

  addManual() {
    const name = this.manualDatabase.trim();
    if (name && !this.selectedDatabases().includes(name)) {
      this.databasesChange.emit([...this.selectedDatabases(), name]);
    }
    this.manualDatabase = "";
  }
}
