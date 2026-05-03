import { Component, Input } from "@angular/core";

@Component({
  selector: "app-progress-bar",
  standalone: true,
  templateUrl: "./progress-bar.component.html",
})
export class ProgressBarComponent {
  @Input() value: number = 0;
  @Input() color: string = "#10b981";
  @Input() animated: boolean = true;

  get clampedValue(): number {
    return Math.max(0, Math.min(100, this.value));
  }
}