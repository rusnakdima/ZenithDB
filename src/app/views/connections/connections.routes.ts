import { Routes } from "@angular/router";
import { ConnectionsComponent } from "./connections.component";
import { ConnectionFormComponent } from "./connection-form/connection-form.component";
import { ConnectionDetailComponent } from "./connection-detail/connection-detail.component";
import { DatabaseDetailComponent } from "./database-detail/database-detail.component";

export const connectionsRoutes: Routes = [
  { path: "", component: ConnectionsComponent },
  { path: "new", component: ConnectionFormComponent },
  { path: ":id", component: ConnectionDetailComponent },
  { path: ":id/edit", component: ConnectionFormComponent },
  { path: ":id/:dbName", component: DatabaseDetailComponent },
  {
    path: ":id/:dbName/explorer",
    loadChildren: () => import("../explorer/explorer.routes").then((m) => m.explorerRoutes),
  },
];
