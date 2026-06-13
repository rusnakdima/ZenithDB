import { Injectable, inject } from "@angular/core";
import { ActivatedRouteSnapshot, Resolve, Router, RouterStateSnapshot } from "@angular/router";
import { DataStoreService } from "@services/core/data-store.service";

interface ResolveResult {
  loaded: boolean;
  fromCache?: boolean;
  collection?: string;
}

@Injectable({
  providedIn: "root",
})
export class InitialDataResolver implements Resolve<unknown> {
  private store = inject(DataStoreService);
  private router = inject(Router);

  resolve(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): unknown {
    const url = state.url || this.router.url;
    const segments = url.split("/").filter((s) => s);
    const connIdIndex = segments.indexOf("connections");

    if (connIdIndex !== -1 && segments[connIdIndex + 1]) {
      const connectionId = segments[connIdIndex + 1];
      const collectionParam = route.queryParamMap.get("collection");

      this.store.ensureConnectionsLoaded().catch(() => {});

      if (connectionId) {
        this.store.ensureCollectionsLoaded(connectionId).catch(() => {});
      }

      if (collectionParam) {
        this.store.loadColumns(collectionParam).catch(() => {});
      }
    }

    return { loaded: true };
  }
}

@Injectable({
  providedIn: "root",
})
export class CollectionDataResolver implements Resolve<unknown> {
  private store = inject(DataStoreService);

  resolve(route: ActivatedRouteSnapshot): unknown {
    const collection = route.queryParamMap.get("collection");
    if (!collection) {
      return { loaded: true } as ResolveResult;
    }

    this.store
      .ensureDataLoaded(collection, { limit: 50 })
      .then(() => {
        return { loaded: true, collection } as ResolveResult;
      })
      .catch(() => {
        return { loaded: true, collection } as ResolveResult;
      });

    return { loaded: true, collection } as ResolveResult;
  }
}
