import { Component, inject } from "@angular/core";
import { LoadingService } from "@shared/services/loading.service";
import { ModalComponent } from "@shared/components/modal/modal.component";

@Component({
  selector: "app-loading-overlay",
  standalone: true,
  imports: [ModalComponent],
  templateUrl: "./loading-overlay.component.html",
})
export class LoadingOverlayComponent {
  loadingService = inject(LoadingService);
}
