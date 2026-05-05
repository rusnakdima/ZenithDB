import { Component, input } from "@angular/core";
import { CommonModule } from "@angular/common";

@Component({
  selector: "app-page-container",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./page-container.component.html",
})
export class PageContainerComponent {
  title = input<string>("");
  subtitle = input<string>("");
}
