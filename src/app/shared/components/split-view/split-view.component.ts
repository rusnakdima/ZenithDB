import { Component, input } from "@angular/core";
import { CommonModule } from "@angular/common";
@Component({
  selector: "app-split-view",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./split-view.component.html",
})
export class SplitViewComponent {
  mode = input<"none" | "horizontal" | "vertical">("none");
}
