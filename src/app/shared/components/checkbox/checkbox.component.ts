import { Component, input, output, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";

export type CheckboxVariant = "accent" | "gray";

@Component({
  selector: "app-checkbox",
  standalone: true,
  imports: [FormsModule],
  templateUrl: "./checkbox.component.html",
  styleUrl: "./checkbox.component.css",
})
export class CheckboxComponent {
  id = input<string>("");
  checked = input<boolean>(false);
  disabled = input<boolean>(false);
  label = input<string>("");
  variant = input<CheckboxVariant>("accent");

  changed = output<boolean>();

  onChange(checked: boolean) {
    this.changed.emit(checked);
  }
}
