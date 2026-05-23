import { Injectable, inject } from "@angular/core";
import { ActivatedRouteSnapshot, Resolve, Router, RouterStateSnapshot } from "@angular/router";
import { Observable } from "rxjs";
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

  resolve(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<unknown> {
    return new Observable((observer) => {
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

      observer.next({ loaded: true });
      observer.complete();
    });
  }
}

@Injectable({
  providedIn: "root",
})
export class CollectionDataResolver implements Resolve<unknown> {
  private store = inject(DataStoreService);

  resolve(route: ActivatedRouteSnapshot): Observable<unknown> {
    return new Observable((observer) => {
      const collection = route.queryParamMap.get("collection");
      if (!collection) {
        observer.next({ loaded: true } as ResolveResult);
        observer.complete();
        return;
      }

      this.store
        .ensureDataLoaded(collection, { limit: 50 })
        .then(() => {
          observer.next({ loaded: true, collection } as ResolveResult);
          observer.complete();
        })
        .catch(() => {
          observer.next({ loaded: true, collection } as ResolveResult);
          observer.complete();
        });
    });
  }
}
