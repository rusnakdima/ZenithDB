import { Component, Input, Output, EventEmitter } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { IndexOptions } from "./index.service";
import { IndexType } from "./create-index-dialog.component";

@Component({
  selector: "app-index-options",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./index-options.component.html",
})
export class IndexOptionsComponent {
  @Input() indexType: IndexType = "single";
  @Input() options: IndexOptions = {};
  @Output() optionsChange = new EventEmitter<IndexOptions>();

  onUniqueChange(unique: boolean): void {
    this.optionsChange.emit({ ...this.options, unique });
  }

  onSparseChange(sparse: boolean): void {
    this.optionsChange.emit({ ...this.options, sparse });
  }

  onTtlSecondsChange(ttlSeconds: number): void {
    this.optionsChange.emit({ ...this.options, ttlSeconds });
  }

  onDefaultLanguageChange(defaultLanguage: string): void {
    this.optionsChange.emit({ ...this.options, defaultLanguage });
  }
}
