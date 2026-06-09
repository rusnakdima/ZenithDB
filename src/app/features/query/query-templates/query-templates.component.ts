import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
  inject,
  OnInit,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { QueryTemplate, TEMPLATE_CATEGORIES, TemplateCategory } from "../models";
import { TemplateService } from "../services";
import { TemplateCardComponent } from "./template-card/template-card.component";

@Component({
  selector: "app-query-templates",
  standalone: true,
  imports: [CommonModule, FormsModule, TemplateCardComponent],
  templateUrl: "./query-templates.component.html",
})
export class QueryTemplatesComponent implements OnInit {
  private readonly templateService = inject(TemplateService);

  @Output() selectTemplate = new EventEmitter<QueryTemplate>();
  @Output() close = new EventEmitter<void>();
  @Output() createCustom = new EventEmitter<void>();

  templates = this.templateService.templates;
  favorites = this.templateService.favorites;

  searchQuery = signal("");
  activeCategory = signal<TemplateCategory | null>(null);

  categories = Object.entries(TEMPLATE_CATEGORIES).map(([key, value]) => ({
    key: key as TemplateCategory,
    ...value,
  }));

  filteredTemplates = computed(() => {
    let result = this.templates();

    const category = this.activeCategory();
    if (category) {
      result = result.filter((t) => t.category === category);
    }

    const query = this.searchQuery().toLowerCase();
    if (query) {
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.description.toLowerCase().includes(query) ||
          t.keywords?.some((k) => k.toLowerCase().includes(query))
      );
    }

    return result;
  });

  ngOnInit(): void {}

  isFavorite(id: string): boolean {
    return this.templateService.isFavorite(id);
  }

  onSelectTemplate(template: QueryTemplate): void {
    this.selectTemplate.emit(template);
  }

  onToggleFavorite(id: string): void {
    this.templateService.toggleFavorite(id);
  }

  onClose(): void {
    this.close.emit();
  }

  onCreateCustom(): void {
    this.createCustom.emit();
  }
}
