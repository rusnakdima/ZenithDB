import { Routes } from "@angular/router";

export const routes: Routes = [
  { path: "", redirectTo: "connections", pathMatch: "full" },
  {
    path: "connections",
    loadComponent: () =>
      import("./views/connections/connections.component").then((m) => m.ConnectionsComponent),
  },
  {
    path: "connections/new",
    loadComponent: () =>
      import("./features/connections/connection-form/connection-form.component").then(
        (m) => m.ConnectionFormComponent
      ),
  },
  {
    path: "connections/:id",
    loadComponent: () =>
      import("./features/connections/connection-detail/connection-detail.component").then(
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
      import("./features/query/query-editor/query-editor.component").then(
        (m) => m.QueryEditorComponent
      ),
  },
];
