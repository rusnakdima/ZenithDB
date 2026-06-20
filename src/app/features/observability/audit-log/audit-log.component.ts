import {
  Component,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
  OnInit,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatIconModule } from "@angular/material/icon";
import { AuditService, AuditEntry, AuditOperation, AuditFilter } from "./audit.service";
import { ExportService } from "@services/services.export.service";
import { ToastService } from "@services/services.toast.service";
import { ChangeDetailComponent } from "./change-detail.component";
@Component({
  selector: "app-audit-log",
  standalone: true,
  imports: [FormsModule, MatIconModule, ChangeDetailComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./audit-log.component.html",
})
export class AuditLogComponent implements OnInit {
  private auditService = inject(AuditService);
  private exportService = inject(ExportService);
  private toast = inject(ToastService);
  auditLog = signal<AuditEntry[]>([]);
  loading = signal(false);
  selectedEntry = signal<AuditEntry | null>(null);
  expandedRows = signal<Set<string>>(new Set());
  filterOperation = signal<AuditOperation[]>([]);
  filterCollection = signal("");
  filterStartDate = signal("");
  filterEndDate = signal("");
  searchQuery = signal("");
  showExportDialog = signal(false);
  operations: AuditOperation[] = ["Insert", "Update", "Delete", "SoftDelete", "Restore"];
  filteredEntries = computed(() => {
    const filter: AuditFilter = {
      operations: this.filterOperation().length > 0 ? this.filterOperation() : undefined,
      collection: this.filterCollection() || undefined,
      startDate: this.filterStartDate() || undefined,
      endDate: this.filterEndDate() || undefined,
      searchQuery: this.searchQuery() || undefined,
    };
    return this.auditService.filterEntries(this.auditLog(), filter);
  });
  async ngOnInit(): Promise<void> {
    await this.loadAuditLog();
  }
  async loadAuditLog(): Promise<void> {
    this.loading.set(true);
    try {
      const entries = await this.auditService.fetchAuditLog();
      this.auditLog.set(entries);
    } catch (e) {
      this.toast.error(`Failed to load audit log: ${(e as Error).message}`);
    } finally {
      this.loading.set(false);
    }
  }
  onToggleOperationFilter(op: AuditOperation): void {
    this.filterOperation.update((ops) => {
      if (ops.includes(op)) {
        return ops.filter((o) => o !== op);
      }
      return [...ops, op];
    });
  }
  isOperationSelected(op: AuditOperation): boolean {
    return this.filterOperation().includes(op);
  }
  onToggleExpand(id: string): void {
    this.expandedRows.update((rows) => {
      const newRows = new Set(rows);
      if (newRows.has(id)) {
        newRows.delete(id);
      } else {
        newRows.add(id);
      }
      return newRows;
    });
  }
  isExpanded(id: string): boolean {
    return this.expandedRows().has(id);
  }
  onSelectEntry(entry: AuditEntry): void {
    this.selectedEntry.set(entry);
  }
  onCloseDetail(): void {
    this.selectedEntry.set(null);
  }
  async onExport(format: "csv" | "json"): Promise<void> {
    const filter: AuditFilter = {
      operations: this.filterOperation().length > 0 ? this.filterOperation() : undefined,
      collection: this.filterCollection() || undefined,
      startDate: this.filterStartDate() || undefined,
      endDate: this.filterEndDate() || undefined,
      searchQuery: this.searchQuery() || undefined,
    };
    try {
      const { filename, content } = await this.auditService.exportAuditLog(format, filter);
      const data = format === "json" ? JSON.parse(content) : [];
      await this.exportService.export({ format, filename }, data as Record<string, unknown>[]);
    } catch (e) {
      this.toast.error(`Export failed: ${(e as Error).message}`);
    }
    this.showExportDialog.set(false);
  }
  clearFilters(): void {
    this.filterOperation.set([]);
    this.filterCollection.set("");
    this.filterStartDate.set("");
    this.filterEndDate.set("");
    this.searchQuery.set("");
  }
  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString();
  }
  getOperationClass(operation: AuditOperation): string {
    const classMap: Record<AuditOperation, string> = {
      Insert: "text-green-400",
      Update: "text-blue-400",
      Delete: "text-red-400",
      SoftDelete: "text-orange-400",
      Restore: "text-cyan-400",
    };
    return classMap[operation] || "text-[var(--text-main)]";
  }
}
