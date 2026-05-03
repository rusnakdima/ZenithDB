import { Component, inject, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { DatabaseService } from "../../../shared/services/database.service";
import { ConnectionStateService } from "../../../shared/services/connection-state.service";
import { RawResult } from "../../../shared/models/connection.config";

@Component({
  selector: "app-query-editor",
  standalone: true,
  imports: [FormsModule],
  templateUrl: "./query-editor.component.html",
  styleUrl: "./query-editor.component.css",
})
export class QueryEditorComponent implements OnInit {
  query = "";
  results: RawResult | null = null;
  loading = false;
  error = "";
  history: { query: string; timestamp: Date }[] = [];
  selectedCollection = "";

  protected db = inject(DatabaseService);
  protected connState = inject(ConnectionStateService);

  async ngOnInit() {}

  async executeQuery() {
    if (!this.query.trim()) return;
    this.loading = true;
    this.error = "";
    try {
      this.results = await this.db.executeRaw(this.query);
      this.history.unshift({ query: this.query, timestamp: new Date() });
    } catch (e: any) {
      this.error = e.message || "Query failed";
    } finally {
      this.loading = false;
    }
  }

  async loadCollectionData(collection: string) {
    this.selectedCollection = collection;
    this.query = `SELECT * FROM ${collection} LIMIT 100`;
    await this.executeQuery();
  }
}
