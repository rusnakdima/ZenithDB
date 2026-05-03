import { Component, inject, OnInit, signal } from "@angular/core";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { DatabaseService } from "../../../shared/services/database.service";

@Component({
  selector: "app-collection-detail",
  standalone: true,
  imports: [RouterLink],
  templateUrl: "./collection-detail.component.html",
  styleUrl: "./collection-detail.component.css",
})
export class CollectionDetailComponent implements OnInit {
  collectionName = "";
  schema = signal<any>(null);
  stats = signal<any>(null);
  loading = signal(false);

  private db = inject(DatabaseService);
  private route = inject(ActivatedRoute);

  async ngOnInit() {
    this.collectionName = this.route.snapshot.paramMap.get("collection") || "";
    await this.loadDetails();
  }

  async loadDetails() {
    this.loading.set(true);
    try {
      const [schema, stats] = await Promise.all([
        this.db.describeCollection(this.collectionName),
        this.db.getCollectionStats(this.collectionName),
      ]);
      this.schema.set(schema);
      this.stats.set(stats);
    } catch (e) {
      // handle error
    } finally {
      this.loading.set(false);
    }
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }
}
