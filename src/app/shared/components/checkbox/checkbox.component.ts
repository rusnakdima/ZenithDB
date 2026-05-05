import { Component, input, output } from "@angular/core";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { FormsModule } from "@angular/forms";

export type CheckboxVariant = "emerald" | "gray";

@Component({
  selector: "app-checkbox",
  standalone: true,
  imports: [MatCheckboxModule, FormsModule],
  templateUrl: "./checkbox.component.html",
  styleUrl: "./checkbox.component.css",
})
export class CheckboxComponent {
  id = input<string>("");
  checked = input<boolean>(false);
  disabled = input<boolean>(false);
  label = input<string>("");
  variant = input<CheckboxVariant>("emerald");

  changed = output<boolean>();

  onChange(checked: boolean) {
    this.changed.emit(checked);
  }
}
