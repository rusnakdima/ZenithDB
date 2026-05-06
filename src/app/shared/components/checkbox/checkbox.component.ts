import { Component, input, output, signal, computed } from "@angular/core";
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
  value = input<string>("");

  changed = output<boolean>();

  private uniqueId = `checkbox-${Math.random().toString(36).substring(2, 9)}`;

  get inputId(): string {
    return this.id() || this.uniqueId;
  }

  onChange(checked: boolean) {
    this.changed.emit(checked);
  }
}
