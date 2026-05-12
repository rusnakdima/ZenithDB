import { Component, input, output, signal, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatIconModule } from "@angular/material/icon";
import { CheckboxComponent } from "@shared/components/checkbox/checkbox.component";
import { ToastService } from "@services/toast.service";

export interface ConfigFormData {
  name: string;
  path: string;
  uri: string;
  database?: string;
  behavior: string;
  useSsl: boolean;
}

@Component({
  selector: "app-connection-config-form",
  standalone: true,
  imports: [FormsModule, MatIconModule, CheckboxComponent],
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
        <div>
          <label class="form-label">Connection URI</label>
          <input
            type="text"
            [(ngModel)]="data.uri"
            placeholder="mongodb://localhost:27017"
            class="form-input"
          />
        </div>
      }

      @if (provider() === "redis") {
        <div>
          <label class="form-label">Connection URI</label>
          <input
            type="text"
            [(ngModel)]="data.uri"
            placeholder="redis://localhost:6379"
            class="form-input"
          />
        </div>
      }

      @if (provider() === "postgres") {
        <div class="space-y-4">
          <div>
            <label class="form-label">Connection URI</label>
            <input
              type="text"
              [(ngModel)]="data.uri"
              placeholder="postgres://user:pass@localhost:5432"
              class="form-input"
            />
          </div>
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
            <button type="button" (click)="browseFile.emit(false)" class="form-btn form-btn-browse">
              Browse
            </button>
          </div>
        </div>
      }

      @if (provider() === "mysql") {
        <div>
          <label class="form-label">Connection URI</label>
          <input
            type="text"
            [(ngModel)]="data.uri"
            placeholder="mysql://user:pass@localhost:3306"
            class="form-input"
          />
        </div>
      }
    </div>
  `,
})
export class ConnectionConfigFormComponent {
  private toast = inject(ToastService);

  provider = input.required<string>();
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

  ngOnInit() {
    this.data = { ...this.initialData() };
  }

  isStep2Valid(): boolean {
    if (!this.data.name.trim()) return false;
    switch (this.provider()) {
      case "json":
      case "sqlite":
        return !!this.data.path.trim();
      case "mongo":
      case "redis":
      case "postgres":
      case "mysql":
        return !!this.data.uri.trim();
      default:
        return false;
    }
  }
}
