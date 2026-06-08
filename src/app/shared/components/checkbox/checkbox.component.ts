import { Component, input, output, ViewEncapsulation } from "@angular/core";
import { FormsModule } from "@angular/forms";

export type CheckboxVariant = "accent" | "gray";

@Component({
  selector: "app-checkbox",
  standalone: true,
  imports: [FormsModule],
  templateUrl: "./checkbox.component.html",
  encapsulation: ViewEncapsulation.None,
})
export class CheckboxComponent {
  id = input<string>("");
  checked = input<boolean>(false);
  disabled = input<boolean>(false);
  label = input<string>("");
  variant = input<CheckboxVariant>("accent");
  value = input<string>("");

  changed = output<boolean>();

  static idCounter = 0;
  uniqueId = `checkbox-${++CheckboxComponent.idCounter}`;

  get inputId(): string {
    return this.id() || this.uniqueId;
  }

  onChange(checked: boolean) {
    this.changed.emit(checked);
  }
}
