import { Component, inject, ChangeDetectionStrategy, ChangeDetectorRef } from "@angular/core";
import { LoadingService } from "@shared/services/loading.service";
import { ModalComponent } from "@shared/components/modal/modal.component";

@Component({
  selector: "app-loading-overlay",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalComponent],
  templateUrl: "./loading-overlay.component.html",
})
export class LoadingOverlayComponent {
  loadingService = inject(LoadingService);
  private cdr = inject(ChangeDetectorRef);
}
