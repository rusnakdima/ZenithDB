import { Component, Input, Output, EventEmitter } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatIconModule } from "@angular/material/icon";

@Component({
  selector: "app-empty-state",
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: "./empty-state.component.html",
})
export class EmptyStateComponent {
  @Input() icon = "info";
  @Input() title = "";
  @Input() message = "";
  @Input() actionLabel = "";
  @Input() actionIcon = "add";
  @Output() action = new EventEmitter<void>();
}
