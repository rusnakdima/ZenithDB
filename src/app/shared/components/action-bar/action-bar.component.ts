import { Component, signal, input, output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { CollectionMeta } from "../../models/connection.config";

@Component({
  selector: "app-action-bar",
  standalone: true,
  imports: [FormsModule],
  templateUrl: "./action-bar.component.html",
  styleUrl: "./action-bar.component.css",
})
export class ActionBarComponent {
  collection = input.required<CollectionMeta>();
  filterChange = output<string>();
  export = output<void>();
  viewChange = output<"grid" | "json">();

  filter = signal("");
  viewMode = signal<"grid" | "json">("grid");

  applyFilter() {
    this.filterChange.emit(this.filter());
  }

  clearFilter() {
    this.filter.set("");
    this.filterChange.emit("");
  }

  setViewMode(mode: "grid" | "json") {
    this.viewMode.set(mode);
    this.viewChange.emit(mode);
  }
}
