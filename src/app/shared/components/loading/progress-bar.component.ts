import { Component, Input } from "@angular/core";
@Component({
  selector: "app-progress-bar",
  standalone: true,
  templateUrl: "./progress-bar.component.html",
})
export class ProgressBarComponent {
  @Input() value = 0;
  @Input() color = "emerald-500";
  @Input() animated = false;
  get clampedValue(): number {
    return Math.min(100, Math.max(0, this.value));
  }
  get showText(): boolean {
    return this.clampedValue > 20;
  }
  get barClasses(): string {
    return this.animated
      ? "bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_1.5s_infinite]"
      : "";
  }
}
