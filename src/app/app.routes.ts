import { Routes } from "@angular/router";

export const routes: Routes = [
  { path: "", redirectTo: "connections", pathMatch: "full" },
  {
    path: "connections",
    loadChildren: () =>
      import("./views/connections/connections.routes").then((m) => m.connectionsRoutes),
  },
  {
    path: "query",
    loadComponent: () =>
      import("./views/workbench/workbench.component").then((m) => m.WorkbenchComponent),
  },
];
