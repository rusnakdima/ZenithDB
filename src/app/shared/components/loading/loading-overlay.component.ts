import { Component, inject } from "@angular/core";
import { LoadingService } from "@shared/services/loading.service";

@Component({
  selector: "app-loading-overlay",
  standalone: true,
  templateUrl: "./loading-overlay.component.html",
})
export class LoadingOverlayComponent {
  loadingService = inject(LoadingService);
}
