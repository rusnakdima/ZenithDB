import { Component, input, output, signal, computed, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatIconModule } from "@angular/material/icon";
import { DatabaseService } from "@shared/services/database.service";
import { ToastService } from "@services/toast.service";
import { CollectionMeta, ColumnInfo } from "@shared/models/connection.config";

interface ColumnComparison {
  name: string;
  leftType: string | null;
  rightType: string | null;
  status: "match" | "left_only" | "right_only" | "different";
}

@Component({
  selector: "app-compare-tables-dialog",
  standalone: true,
  imports: [FormsModule, MatIconModule],
  templateUrl: "./compare-tables-dialog.component.html",
})
export class CompareTablesDialogComponent {
  close = output<void>();

  private db = inject(DatabaseService);
  private toast = inject(ToastService);

  collections = input<CollectionMeta[]>([]);
  connectionId = input<string | null>(null);

  leftTable = signal<string>("");
  rightTable = signal<string>("");

  leftColumns = signal<ColumnInfo[]>([]);
  rightColumns = signal<ColumnInfo[]>([]);

  loading = signal(false);
  comparing = signal(false);

  comparisonResult = signal<ColumnComparison[]>([]);

  showLeftDropdown = signal(false);
  showRightDropdown = signal(false);

  filteredLeftCollections = computed(() => {
    const search = this.leftTable().toLowerCase();
    if (!search) return this.collections().slice(0, 20);
    return this.collections()
      .filter((c) => c.name.toLowerCase().includes(search))
      .slice(0, 20);
  });

  filteredRightCollections = computed(() => {
    const search = this.rightTable().toLowerCase();
    if (!search) return this.collections().slice(0, 20);
    return this.collections()
      .filter((c) => c.name.toLowerCase().includes(search))
      .slice(0, 20);
  });

  async loadColumnsForTable(tableName: string, side: "left" | "right") {
    if (!tableName) return;
    this.loading.set(true);
    try {
      const schema = await this.db.describeCollection(tableName);
      if (side === "left") {
        this.leftColumns.set(schema.columns);
      } else {
        this.rightColumns.set(schema.columns);
      }
    } catch (e) {
      this.toast.error(`Failed to load schema for ${tableName}`);
    } finally {
      this.loading.set(false);
    }
  }

  selectLeftTable(name: string) {
    this.leftTable.set(name);
    this.showLeftDropdown.set(false);
    this.loadColumnsForTable(name, "left");
    this.runComparison();
  }

  selectRightTable(name: string) {
    this.rightTable.set(name);
    this.showRightDropdown.set(false);
    this.loadColumnsForTable(name, "right");
    this.runComparison();
  }

  runComparison() {
    const left = this.leftColumns();
    const right = this.rightColumns();

    if (left.length === 0 && right.length === 0) {
      this.comparisonResult.set([]);
      return;
    }

    const leftMap = new Map(left.map((c) => [c.name, c]));
    const rightMap = new Map(right.map((c) => [c.name, c]));

    const allNames = new Set([...leftMap.keys(), ...rightMap.keys()]);
    const result: ColumnComparison[] = [];

    for (const name of Array.from(allNames).sort()) {
      const leftCol = leftMap.get(name);
      const rightCol = rightMap.get(name);

      let status: ColumnComparison["status"];
      let leftType: string | null = null;
      let rightType: string | null = null;

      if (leftCol && rightCol) {
        leftType = leftCol.data_type;
        rightType = rightCol.data_type;
        status = leftCol.data_type === rightCol.data_type ? "match" : "different";
      } else if (leftCol) {
        leftType = leftCol.data_type;
        status = "left_only";
      } else {
        rightType = rightCol!.data_type;
        status = "right_only";
      }

      result.push({ name, leftType, rightType, status });
    }

    this.comparisonResult.set(result);
  }

  toggleLeftDropdown() {
    this.showLeftDropdown.update((v) => !v);
    this.showRightDropdown.set(false);
  }

  toggleRightDropdown() {
    this.showRightDropdown.update((v) => !v);
    this.showLeftDropdown.set(false);
  }

  getStatusIcon(status: ColumnComparison["status"]): string {
    switch (status) {
      case "match":
        return "check_circle";
      case "different":
        return "swap_horiz";
      case "left_only":
        return "arrow_back";
      case "right_only":
        return "arrow_forward";
    }
  }

  getStatusColor(status: ColumnComparison["status"]): string {
    switch (status) {
      case "match":
        return "text-green-400";
      case "different":
        return "text-yellow-400";
      case "left_only":
      case "right_only":
        return "text-red-400";
    }
  }

  getSummary() {
    const result = this.comparisonResult();
    const match = result.filter((r) => r.status === "match").length;
    const different = result.filter((r) => r.status === "different").length;
    const leftOnly = result.filter((r) => r.status === "left_only").length;
    const rightOnly = result.filter((r) => r.status === "right_only").length;
    return { match, different, leftOnly, rightOnly, total: result.length };
  }

  onBackdropClick(event: MouseEvent) {
    this.close.emit();
  }

  onDrawerClick(event: MouseEvent) {
    event.stopPropagation();
  }

  onClose() {
    this.close.emit();
  }
}
