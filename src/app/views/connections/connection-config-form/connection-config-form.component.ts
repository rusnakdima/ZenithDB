import { Component, input, output, signal, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatIconModule } from "@angular/material/icon";
import { CheckboxComponent } from "@shared/components/checkbox/checkbox.component";
import { DatabaseService } from "@shared/services/database.service";
import { ProviderType } from "@shared/models/provider.model";
import { DatabaseMeta } from "@shared/models/connection.config";
import { DatabaseSelectorComponent } from "../database-selector/database-selector.component";
import { ToastService } from "@services/toast.service";

export interface ConfigFormData {
  name: string;
  path: string;
  uri: string;
  database: string;
  behavior: string;
  useSsl: boolean;
}

@Component({
  selector: "app-connection-config-form",
  standalone: true,
  imports: [FormsModule, MatIconModule, CheckboxComponent, DatabaseSelectorComponent],
  template: `
    <div class="space-y-5">
      <div>
        <label class="form-label">Connection Name</label>
        <input type="text" [(ngModel)]="data.name" placeholder="My Database" class="form-input" />
      </div>

      @if (provider() === "json") {
        <div>
          <label class="form-label">Folder Path</label>
          <div class="flex gap-3">
            <input
              type="text"
              [(ngModel)]="data.path"
              placeholder="/path/to/json-databases"
              class="form-input flex-1"
            />
            <button type="button" (click)="browseFile.emit(true)" class="form-btn form-btn-browse">
              Browse
            </button>
          </div>
        </div>
        <div>
          <label class="form-label">Database Structure</label>
          <select [(ngModel)]="data.behavior" class="form-input">
            <option value="folders_as_databases">Subfolders as databases</option>
            <option value="files_as_collections">Files as collections</option>
            <option value="mixed">Mixed (both)</option>
          </select>
          <p class="mt-1 text-xs text-[var(--text-dim)]">
            @if (data.behavior === "folders_as_databases") {
              Each subfolder = a database containing JSON files as collections
            } @else if (data.behavior === "files_as_collections") {
              JSON files in the folder = collections in a single database
            } @else {
              Subfolders are databases, plus JSON files at root level
            }
          </p>
        </div>
      }

      @if (provider() === "mongo") {
        <div class="space-y-4">
          <div>
            <label class="form-label">Connection URI</label>
            <input
              type="text"
              [(ngModel)]="data.uri"
              (ngModelChange)="onUriChange()"
              placeholder="mongodb://localhost:27017"
              class="form-input"
            />
          </div>
          <app-database-selector
            [provider]="provider()"
            [uri]="data.uri"
            [selectedDatabases]="selectedDatabases()"
            (databasesChange)="onDatabasesChange($event)"
          />
          @if (
            !loadingDatabases() &&
            availableDatabases().length === 0 &&
            data.uri.length > 10 &&
            databasesLoaded()
          ) {
            <div>
              <label class="form-label">Database Name</label>
              <input
                type="text"
                [(ngModel)]="data.database"
                placeholder="mydb"
                class="form-input"
              />
            </div>
          }
        </div>
      }

      @if (provider() === "redis") {
        <div class="space-y-4">
          <div>
            <label class="form-label">Connection URI</label>
            <input
              type="text"
              [(ngModel)]="data.uri"
              (ngModelChange)="onUriChange()"
              placeholder="redis://localhost:6379"
              class="form-input"
            />
          </div>
          @if (loadingDatabases()) {
            <div class="flex items-center gap-2 text-sm text-[var(--text-dim)]">
              <mat-icon fontIcon="sync" class="h-5! w-5! text-xl!" />
              Loading databases...
            </div>
          }
          @if (availableDatabases().length > 0) {
            <div>
              <label class="form-label">Select Databases</label>
              <div
                class="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2"
              >
                @for (db of availableDatabases(); track db.name) {
                  <app-checkbox
                    [checked]="isDatabaseSelected(db.name)"
                    [label]="db.name"
                    (changed)="onDatabaseCheckboxChange($event, db.name)"
                  />
                }
              </div>
              @if (selectedDatabases().length > 0) {
                <p class="mt-2 text-xs text-[var(--text-dim)]">
                  Selected: {{ selectedDatabases().join(", ") }}
                </p>
              }
              <div class="mt-3 flex gap-2">
                <input
                  type="text"
                  [(ngModel)]="manualDatabase"
                  placeholder="Enter database name"
                  class="form-input flex-1"
                />
                <button
                  type="button"
                  (click)="addManualDatabase()"
                  class="form-btn form-btn-secondary"
                >
                  Add
                </button>
              </div>
            </div>
          }
        </div>
      }

      @if (provider() === "postgres") {
        <div class="space-y-4">
          <div>
            <label class="form-label">Connection URI</label>
            <input
              type="text"
              [(ngModel)]="data.uri"
              (ngModelChange)="onUriChange()"
              placeholder="postgres://user:pass@localhost:5432"
              class="form-input"
            />
          </div>
          @if (loadingDatabases()) {
            <div class="flex items-center gap-2 text-sm text-[var(--text-dim)]">
              <mat-icon fontIcon="sync" class="h-5! w-5! text-xl!" />
              Loading databases...
            </div>
          }
          @if (availableDatabases().length > 0) {
            <div>
              <label class="form-label">Select Databases</label>
              <div
                class="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2"
              >
                @for (db of availableDatabases(); track db.name) {
                  <app-checkbox
                    [checked]="isDatabaseSelected(db.name)"
                    [label]="db.name"
                    (changed)="onDatabaseCheckboxChange($event, db.name)"
                  />
                }
              </div>
              @if (selectedDatabases().length > 0) {
                <p class="mt-2 text-xs text-[var(--text-dim)]">
                  Selected: {{ selectedDatabases().join(", ") }}
                </p>
              }
            </div>
          }
          <div class="flex items-center gap-2">
            <app-checkbox [checked]="data.useSsl" (changed)="data.useSsl = $event" />
            <label for="ssl-toggle" class="text-sm text-[var(--text-dim)]">Use SSL/TLS</label>
          </div>
        </div>
      }

      @if (provider() === "sqlite") {
        <div>
          <label class="form-label">Database File Path</label>
          <div class="flex gap-3">
            <input
              type="text"
              [(ngModel)]="data.path"
              placeholder="/path/to/database.db"
              class="form-input flex-1"
            />
            <button type="button" (click)="browseFile.emit(true)" class="form-btn form-btn-browse">
              Browse
            </button>
          </div>
        </div>
      }

      @if (provider() === "mysql") {
        <div class="space-y-4">
          <div>
            <label class="form-label">Connection URI</label>
            <input
              type="text"
              [(ngModel)]="data.uri"
              (ngModelChange)="onUriChange()"
              placeholder="mysql://user:pass@localhost:3306"
              class="form-input"
            />
          </div>
          @if (loadingDatabases()) {
            <div class="flex items-center gap-2 text-sm text-[var(--text-dim)]">
              <mat-icon fontIcon="sync" class="h-5! w-5! text-xl!" />
              Loading databases...
            </div>
          }
          @if (availableDatabases().length > 0) {
            <div>
              <label class="form-label">Select Databases</label>
              <div
                class="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2"
              >
                @for (db of availableDatabases(); track db.name) {
                  <app-checkbox
                    [checked]="isDatabaseSelected(db.name)"
                    [label]="db.name"
                    (changed)="onDatabaseCheckboxChange($event, db.name)"
                  />
                }
              </div>
              @if (selectedDatabases().length > 0) {
                <p class="mt-2 text-xs text-[var(--text-dim)]">
                  Selected: {{ selectedDatabases().join(", ") }}
                </p>
              }
              <div class="mt-3 flex gap-2">
                <input
                  type="text"
                  [(ngModel)]="manualDatabase"
                  placeholder="Enter database name"
                  class="form-input flex-1"
                />
                <button
                  type="button"
                  (click)="addManualDatabase()"
                  class="form-btn form-btn-secondary"
                >
                  Add
                </button>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class ConnectionConfigFormComponent {
  private db = inject(DatabaseService);
  private toast = inject(ToastService);

  provider = input.required<ProviderType>();
  initialData = input<ConfigFormData>({
    name: "",
    path: "",
    uri: "",
    database: "",
    behavior: "folders_as_databases",
    useSsl: false,
  });

  dataChange = output<ConfigFormData>();
  browseFile = output<boolean>();
  validChange = output<boolean>();

  data: ConfigFormData = {
    name: "",
    path: "",
    uri: "",
    database: "",
    behavior: "folders_as_databases",
    useSsl: false,
  };

  availableDatabases = signal<DatabaseMeta[]>([]);
  loadingDatabases = signal(false);
  databasesLoaded = signal(false);
  selectedDatabases = signal<string[]>([]);
  manualDatabase = "";

  ngOnInit() {
    this.data = { ...this.initialData() };
    if (this.data.database) {
      this.selectedDatabases.set(this.data.database.split(",").map((d) => d.trim()));
    }
  }

  isStep2Valid(): boolean {
    if (!this.data.name.trim()) return false;
    switch (this.provider()) {
      case "json":
      case "sqlite":
        return !!this.data.path.trim();
      case "mongo":
        return !!this.data.uri.trim() && !!this.data.database.trim();
      case "redis":
      case "postgres":
      case "mysql":
        return !!this.data.uri.trim();
      default:
        return false;
    }
  }

  async onUriChange() {
    if (
      (this.provider() === "postgres" ||
        this.provider() === "mysql" ||
        this.provider() === "mongo" ||
        this.provider() === "redis") &&
      this.data.uri.length > 10
    ) {
      this.availableDatabases.set([]);
      this.selectedDatabases.set([]);
      this.databasesLoaded.set(false);
      this.loadingDatabases.set(true);
      try {
        const dbs = await this.db.listDatabasesForUri(this.provider(), this.data.uri);
        this.availableDatabases.set(dbs);
        this.databasesLoaded.set(true);
      } catch (e) {
        this.toast.error("Failed to load databases");
      } finally {
        this.loadingDatabases.set(false);
      }
    }
  }

  isDatabaseSelected(dbName: string): boolean {
    return this.selectedDatabases().includes(dbName);
  }

  onDatabaseCheckboxChange(event: boolean, dbName: string) {
    if (event) {
      if (!this.selectedDatabases().includes(dbName)) {
        this.selectedDatabases.set([...this.selectedDatabases(), dbName]);
      }
    } else {
      this.selectedDatabases.set(this.selectedDatabases().filter((n) => n !== dbName));
    }
    this.data.database = this.selectedDatabases().join(",");
    this.dataChange.emit(this.data);
  }

  onDatabasesChange(databases: string[]) {
    this.selectedDatabases.set(databases);
    this.data.database = databases.join(",");
    this.dataChange.emit(this.data);
  }

  addManualDatabase() {
    const name = this.manualDatabase.trim();
    if (name && !this.selectedDatabases().includes(name)) {
      this.selectedDatabases.set([...this.selectedDatabases(), name]);
      this.data.database = this.selectedDatabases().join(",");
      this.dataChange.emit(this.data);
    }
    this.manualDatabase = "";
  }
}
