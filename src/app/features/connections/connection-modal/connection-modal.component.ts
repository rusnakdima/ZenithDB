import { Component, inject, signal, computed } from "@angular/core";
import { Router } from "@angular/router";
import { CommonModule } from "@angular/common";
import { MatIconModule } from "@angular/material/icon";
import { ConnectionStateService } from "@shared/services/connection-state.service";
import { DataStoreService } from "@services/core/data-store.service";
import { ConnectionSummary } from "@shared/models/connection.config";
import { ToastService } from "@services/toast.service";

interface ConnectionItem {
  connection: ConnectionSummary;
  isActive: boolean;
  status: "connected" | "disconnected" | "unknown";
}

@Component({
  selector: "app-connection-modal",
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: "./connection-modal.component.html",
})
export class ConnectionModalComponent {
  private router = inject(Router);
  private connState = inject(ConnectionStateService);
  private dataStore = inject(DataStoreService);
  private toast = inject(ToastService);

  isOpen = signal(false);
  searchQuery = signal("");
  selectedIndex = signal(0);

  connectionItems = computed<ConnectionItem[]>(() => {
    const connections = this.dataStore.connections();
    const activeId = this.connState.activeConnectionId();
    return connections.map((conn) => ({
      connection: conn,
      isActive: conn.id === activeId,
      status: conn.id === activeId ? "connected" : "disconnected",
    }));
  });

  filteredItems = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const items = this.connectionItems();
    if (!query) return items;
    return items.filter((item) => item.connection.name.toLowerCase().includes(query));
  });

  open() {
    this.isOpen.set(true);
    this.searchQuery.set("");
    this.selectedIndex.set(0);
  }

  close() {
    this.isOpen.set(false);
  }

  onBackdropClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains("connection-modal-backdrop")) {
      this.close();
    }
  }

  onSearchInput(value: string) {
    this.searchQuery.set(value);
    this.selectedIndex.set(0);
  }

  handleKeydown(event: KeyboardEvent) {
    const items = this.filteredItems();
    if (items.length === 0) return;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        this.selectedIndex.update((i) => Math.min(i + 1, items.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        this.selectedIndex.update((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        event.preventDefault();
        this.selectItem(items[this.selectedIndex()]);
        break;
      case "Escape":
        event.preventDefault();
        this.close();
        break;
    }
  }

  selectItem(item: ConnectionItem) {
    this.connState.setActiveConnection(item.connection);
    this.router.navigate(["/connections", item.connection.id]);
    this.close();
  }

  disconnect(item: ConnectionItem, event: MouseEvent) {
    event.stopPropagation();
    this.connState.activeConnectionId.set(null);
    this.connState.activeConnectionName.set(null);
    this.connState.activeProvider.set(null);
    this.connState.activeConnection.set(null);
    this.toast.success(`Disconnected from "${item.connection.name}"`);
  }

  viewDetails(item: ConnectionItem, event: MouseEvent) {
    event.stopPropagation();
    this.router.navigate(["/connections", item.connection.id]);
    this.close();
  }

  getStatusColor(status: string): string {
    switch (status) {
      case "connected":
        return "text-green-400";
      case "disconnected":
        return "text-zinc-500";
      default:
        return "text-zinc-400";
    }
  }

  getStatusBg(status: string): string {
    switch (status) {
      case "connected":
        return "bg-green-400";
      case "disconnected":
        return "bg-zinc-600";
      default:
        return "bg-zinc-500";
    }
  }
}
