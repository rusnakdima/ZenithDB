import { Component, output, inject } from "@angular/core";
import { ConnectionStateService } from "../../shared/services/connection-state.service";

@Component({
  selector: "app-sidebar",
  standalone: true,
  imports: [],
  templateUrl: "./sidebar.component.html",
})
export class SidebarComponent {
  connectionState = inject(ConnectionStateService);
  collectionSelected = output<string>();

  isLocalExpanded = true;

  pinnedConnections = [
    { name: "production_main", type: "SQL", icon: "database" },
    { name: "customer_360", type: "NoSQL", icon: "leaf" },
  ];

  localInstances = [
    {
      name: "localhost:27017",
      expanded: true,
      databases: [
        { name: "admin", collections: [] },
        { name: "config", collections: [] },
        {
          name: "ecommerce",
          expanded: true,
          collections: ["categories", "orders", "products"],
        },
      ],
    },
  ];

  activeCollection: string | null = null;

  onCollectionClick(collection: string) {
    this.activeCollection = collection;
    this.collectionSelected.emit(collection);
  }

  toggleLocal() {
    this.isLocalExpanded = !this.isLocalExpanded;
  }

  getIconClass(icon: string): string {
    const iconMap: Record<string, string> = {
      database: "fa-database",
      leaf: "fa-leaf",
    };
    return iconMap[icon] || "fa-database";
  }

  getProviderBadgeClass(name: string): string {
    return name === "NoSQL" ? "text-green-600" : "text-slate-600";
  }
}
