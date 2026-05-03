import { Component, Input, Output, EventEmitter, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";

@Component({
  selector: "app-filter-bar",
  standalone: true,
  imports: [FormsModule],
  templateUrl: "./filter-bar.component.html",
})
export class FilterBarComponent {
  @Input() filter = "";
  @Input() viewMode: "grid" | "json" = "grid";

  @Output() filterChange = new EventEmitter<string>();
  @Output() apply = new EventEmitter<void>();
  @Output() clear = new EventEmitter<void>();
  @Output() export = new EventEmitter<void>();
  @Output() toggleView = new EventEmitter<void>();

  localFilter = "";

  ngOnChanges() {
    this.localFilter = this.filter;
  }

  onFilterInput(value: string) {
    this.localFilter = value;
    this.filterChange.emit(value);
  }

  onApply() {
    this.filterChange.emit(this.localFilter);
    this.apply.emit();
  }

  onClear() {
    this.localFilter = "";
    this.filterChange.emit("");
    this.clear.emit();
  }

  onToggleView() {
    this.toggleView.emit();
  }
}
