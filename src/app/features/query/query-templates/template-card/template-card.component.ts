import { Component, Input, Output, EventEmitter, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { QueryTemplate, TEMPLATE_CATEGORIES } from "../../models";
import { getLoggingService } from "@tauri-apps/logger";

@Component({
  selector: "app-template-card",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./template-card.component.html",
})
export class TemplateCardComponent {
  private readonly logger = getLoggingService();

  @Input() template!: QueryTemplate;
  @Input() isFavorite = false;

  @Output() select = new EventEmitter<QueryTemplate>();
  @Output() toggleFavorite = new EventEmitter<string>();

  getCategoryLabel(): string {
    return TEMPLATE_CATEGORIES[this.template.category]?.label ?? this.template.category;
  }

  getCategoryColor(): string {
    const color = TEMPLATE_CATEGORIES[this.template.category]?.color ?? "text-slate-400";
    return `${color} bg-slate-700/50`;
  }

  onFavoriteClick(event: MouseEvent): void {
    this.logger.debug("[QUERY_TEMPLATE]", "Toggle favorite from card", { id: this.template.id });
    event.stopPropagation();
    this.toggleFavorite.emit(this.template.id);
  }
}
