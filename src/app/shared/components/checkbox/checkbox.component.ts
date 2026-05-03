import { Component, input, output } from "@angular/core";
import { MatCheckboxModule } from "@angular/material/checkbox";

@Component({
  selector: "app-checkbox",
  standalone: true,
  imports: [MatCheckboxModule],
  templateUrl: "./checkbox.component.html",
  styleUrl: "./checkbox.component.css"
})
export class CheckboxComponent {
  checked = input<boolean>(false);
  disabled = input<boolean>(false);
  label = input<string>("");

  changed = output<boolean>();

  onChange(checked: boolean) {
    this.changed.emit(checked);
  }
}
