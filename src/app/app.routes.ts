import { Routes } from "@angular/router";

export const routes: Routes = [
  { path: "", redirectTo: "connections", pathMatch: "full" },

  // Connections
  {
    path: "connections",
    loadComponent: () =>
      import("./views/connections/connections.view").then((m) => m.ConnectionsComponent),
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
    path: "connections/:id/edit",
    loadComponent: () =>
      import("./views/connections/connection-form/connection-form.component").then(
        (m) => m.ConnectionFormComponent
      ),
  },
  {
    path: "connections/:id/:dbName",
    loadComponent: () =>
      import("./views/connections/database-detail/database-detail.component").then(
        (m) => m.DatabaseDetailComponent
      ),
  },
  {
    path: "connections/:id/:dbName/explorer",
    loadComponent: () => import("./views/explorer/explorer.view").then((m) => m.ExplorerComponent),
  },
  {
    path: "connections/:id/:dbName/explorer/collection/:collection",
    loadComponent: () => import("./views/explorer/explorer.view").then((m) => m.ExplorerComponent),
  },

  // Query (Workbench)
  {
    path: "query",
    loadComponent: () =>
      import("./views/workbench/workbench.view").then((m) => m.WorkbenchComponent),
  },

  // Settings
  {
    path: "settings",
    loadComponent: () => import("./views/settings/settings.view").then((m) => m.SettingsComponent),
  },
];
