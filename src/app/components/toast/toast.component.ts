import { Component, input, output } from "@angular/core";

@Component({
  selector: "app-toast",
  standalone: true,
  templateUrl: "./toast.component.html",
})
export class ToastComponent {
  toast = input.required<any>();
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
