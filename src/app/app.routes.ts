import { Routes } from "@angular/router";

export const routes: Routes = [
  { path: "", redirectTo: "connections", pathMatch: "full" },
  {
    path: "",
    loadComponent: () =>
      import("./views/dashboard/dashboard.component").then((m) => m.DashboardComponent),
  },
  {
    path: "connections",
    loadChildren: () =>
      import("./views/connections/connections.routes").then((m) => m.connectionsRoutes),
  },
  {
    path: "connections/new",
    loadComponent: () =>
      import("./views/connections/connection-form/connection-form.component").then(
        (m) => m.ConnectionFormComponent
      ),
  },
  {
    path: "connections/:id",
    loadComponent: () =>
      import("./views/connections/connection-detail/connection-detail.component").then(
        (m) => m.ConnectionDetailComponent
      ),
  },
  {
    path: "schema",
    loadComponent: () =>
      import("./features/schema/schema-tree/schema-tree.component").then(
        (m) => m.SchemaTreeComponent
      ),
  },
  {
    path: "schema/:collection",
    loadComponent: () =>
      import("./features/schema/collection-detail/collection-detail.component").then(
        (m) => m.CollectionDetailComponent
      ),
  },
  {
    path: "data/:collection",
    loadComponent: () =>
      import("./features/data/data-grid/data-grid.component").then((m) => m.DataGridComponent),
  },
  {
    path: "query",
    loadComponent: () =>
      import("./views/workbench/workbench.component").then((m) => m.WorkbenchComponent),
  },
  {
    path: "explorer",
    loadComponent: () =>
      import("./views/explorer/explorer.component").then((m) => m.ExplorerComponent),
  },
];
