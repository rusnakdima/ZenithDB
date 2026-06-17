import { Component, input, output, signal, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatIconModule } from "@angular/material/icon";
import { ToastService } from "@services/toast.service";
import { logger } from "../../../services/logger.service";

@Component({
  selector: "app-add-database-path",
  standalone: true,
  imports: [FormsModule, MatIconModule],
  templateUrl: "./add-database-path.component.html",
})
export class AddDatabasePathComponent {
  private toast = inject(ToastService);
  

  provider = input.required<string>();
  connectionId = input.required<string>();

  added = output<{ name: string; path: string }>();
  cancelled = output<void>();

  dbName = signal("");
  dbPath = signal("");

  async onBrowsePath() {
    try {
      logger.debug("[ADD_DATABASE_PATH]", "Opening file dialog");
      const { open } = await import("@tauri-apps/plugin-dialog");
      const isJson = this.provider() === "json";
      const selected = await open({
        multiple: false,
        directory: isJson,
        filters: isJson
          ? []
          : [{ name: "SQLite Database", extensions: ["db", "sqlite", "sqlite3"] }],
      });
      if (selected) {
        const path = selected as string;
        this.dbPath.set(path);
        this.dbName.set(this.extractName(path, isJson));
        logger.info("[ADD_DATABASE_PATH]", "File selected", { path, name: this.dbName() });
      }
    } catch (e) {
      logger.error("[ADD_DATABASE_PATH]", "Failed to open file dialog", { error: String(e) });
      this.toast.error("Failed to open file dialog");
    }
  }

  private extractName(path: string, isJson: boolean): string {
    if (isJson) {
      const parts = path.split("/");
      return parts[parts.length - 1] || "";
    } else {
      const filename = path.split("/").pop() || "";
      const lastDot = filename.lastIndexOf(".");
      return lastDot > 0 ? filename.substring(0, lastDot) : filename;
    }
  }

  onAdd() {
    const name = this.dbName().trim();
    const path = this.dbPath().trim();
    if (!name) return;
    logger.info("[ADD_DATABASE_PATH]", "Database path added", { name, path });
    this.added.emit({ name, path });
  }

  onCancel() {
    logger.debug("[ADD_DATABASE_PATH]", "Cancelled");
    this.cancelled.emit();
  }
}
