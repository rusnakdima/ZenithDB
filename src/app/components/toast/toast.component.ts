import { Component, input, output } from "@angular/core";
import { ToastConfig } from "@services/services.toast.service";

@Component({
  selector: "app-toast",
  standalone: true,
  templateUrl: "./toast.component.html",
})
export class ToastComponent {
  toast = input.required<ToastConfig>();
  dismiss = output<string>();

  onDismiss(): void {
    this.dismiss.emit(this.toast().id);
  }

  onAction(): void {
    const action = this.toast().action;
    if (action) {
      action.callback();
    }
    this.dismiss.emit(this.toast().id);
  }
}
