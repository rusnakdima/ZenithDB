import { Routes } from "@angular/router";
import { ExplorerComponent } from "./explorer.component";
import { InitialDataResolver, CollectionDataResolver } from "@app/resolvers/initial-data.resolver";

export const explorerRoutes: Routes = [
  {
    path: "",
    component: ExplorerComponent,
    resolve: {
      initialData: InitialDataResolver,
    },
  },
  {
    path: "collection/:collection",
    component: ExplorerComponent,
    resolve: {
      initialData: InitialDataResolver,
      collectionData: CollectionDataResolver,
    },
  },
];
