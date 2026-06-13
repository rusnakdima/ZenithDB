import { Component, Input, Output, EventEmitter, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { IndexOptions } from "./index.service";
import { IndexType } from "./create-index-dialog.component";
import { LoggingService } from "@shared/services/logging.service";

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

  private logger = inject(LoggingService);

  onUniqueChange(unique: boolean): void {
    this.logger.debug("[INDEX]", "Index unique option changed", { unique });
    this.optionsChange.emit({ ...this.options, unique });
  }

  onSparseChange(sparse: boolean): void {
    this.logger.debug("[INDEX]", "Index sparse option changed", { sparse });
    this.optionsChange.emit({ ...this.options, sparse });
  }

  onTtlSecondsChange(ttlSeconds: number): void {
    this.logger.debug("[INDEX]", "Index TTL option changed", { ttlSeconds });
    this.optionsChange.emit({ ...this.options, ttlSeconds });
  }

  onDefaultLanguageChange(defaultLanguage: string): void {
    this.logger.debug("[INDEX]", "Index default language changed", { defaultLanguage });
    this.optionsChange.emit({ ...this.options, defaultLanguage });
  }
}
