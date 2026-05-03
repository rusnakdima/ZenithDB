import { Component, inject, OnInit, signal } from "@angular/core";
import { RouterLink } from "@angular/router";
import { DatabaseService } from "../../../shared/services/database.service";

@Component({
  selector: "app-schema-tree",
  standalone: true,
  imports: [RouterLink],
  templateUrl: "./schema-tree.component.html",
  styleUrl: "./schema-tree.component.css",
})
export class SchemaTreeComponent implements OnInit {
  collections = signal<any[]>([]);
  expanded = signal<Set<string>>(new Set());
  loading = signal(false);
  error = signal("");

  private db = inject(DatabaseService);

  async ngOnInit() {
    await this.loadCollections();
  }

  async loadCollections() {
    this.loading.set(true);
    this.error.set("");
    try {
      this.collections.set(await this.db.listCollections());
    } catch (e: any) {
      this.error.set(e.message || "Failed to load collections");
    } finally {
      this.loading.set(false);
    }
  }

  toggleExpand(name: string) {
    const current = new Set(this.expanded());
    if (current.has(name)) {
      current.delete(name);
    } else {
      current.add(name);
    }
    this.expanded.set(current);
  }

  isExpanded(name: string): boolean {
    return this.expanded().has(name);
  }
}
