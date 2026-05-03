import { Component, inject, signal, output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { DatabaseService } from "../../shared/services/database.service";
import { ConnectionStateService } from "../../shared/services/connection-state.service";
import { RawResult } from "../../shared/models/connection.config";
import { SqlEditorComponent } from "./sql-editor/sql-editor.component";
import { OutputConsoleComponent } from "./output-console/output-console.component";

@Component({
  selector: "app-workbench",
  standalone: true,
  imports: [FormsModule, SqlEditorComponent, OutputConsoleComponent],
  templateUrl: "./workbench.component.html",
})
export class WorkbenchComponent {
  query = signal("");
  results: RawResult | null = null;
  loading = false;
  error = "";
  selectedDatabase = "ecommerce_main";

  databases = ["ecommerce_main", "analytics_v1"];

  protected db = inject(DatabaseService);
  protected connState = inject(ConnectionStateService);

  async runQuery() {
    const q = this.query();
    if (!q.trim()) return;
    this.loading = true;
    this.error = "";
    try {
      this.results = await this.db.executeRaw(q);
    } catch (e: any) {
      this.error = e.message || "Query failed";
    } finally {
      this.loading = false;
    }
  }

  clearEditor() {
    this.query.set("");
    this.results = null;
  }

  onQueryChange(query: string) {
    this.query.set(query);
  }
}
