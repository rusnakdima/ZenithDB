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
  template: `
    <div class="flex h-full flex-col rounded-lg border border-slate-700 bg-slate-900">
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-slate-700 px-4 py-3">
        <h3 class="text-sm font-medium text-slate-200">Query Templates</h3>
        <button
          type="button"
          class="rounded p-1 text-slate-400 hover:text-white"
          (click)="onClose()"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <!-- Search -->
      <div class="border-b border-slate-700 px-4 py-3">
        <div class="relative">
          <svg
            class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            class="w-full rounded-lg border border-slate-600 bg-slate-800 py-2 pr-4 pl-10 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
            placeholder="Search templates..."
            [ngModel]="searchQuery()"
            (ngModelChange)="searchQuery.set($event)"
          />
        </div>
      </div>

      <!-- Category Tabs -->
      <div class="flex items-center gap-1 overflow-x-auto border-b border-slate-700 px-4 py-2">
        <button
          type="button"
          class="rounded-full px-3 py-1.5 text-xs whitespace-nowrap transition-colors"
          [class.bg-emerald-600]="activeCategory() === null"
          [class.text-white]="activeCategory() === null"
          [class.bg-slate-700]="activeCategory() !== null"
          [class.text-slate-400]="activeCategory() !== null"
          (click)="activeCategory.set(null)"
        >
          All
        </button>
        @for (category of categories; track category.key) {
          <button
            type="button"
            class="rounded-full px-3 py-1.5 text-xs whitespace-nowrap transition-colors"
            [class.bg-emerald-600]="activeCategory() === category.key"
            [class.text-white]="activeCategory() === category.key"
            [class.bg-slate-700]="activeCategory() !== category.key"
            [class.text-slate-400]="activeCategory() !== category.key"
            (click)="activeCategory.set(category.key)"
          >
            {{ category.label }}
          </button>
        }
      </div>

      <!-- Templates List -->
      <div class="flex-1 overflow-y-auto p-4">
        <div class="space-y-3">
          @for (template of filteredTemplates(); track template.id) {
            <app-template-card
              [template]="template"
              [isFavorite]="isFavorite(template.id)"
              (select)="onSelectTemplate($event)"
              (toggleFavorite)="onToggleFavorite($event)"
            />
          } @empty {
            <div class="py-8 text-center">
              <svg
                class="mx-auto mb-3 h-12 w-12 text-slate-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p class="text-sm text-slate-400">No templates found</p>
            </div>
          }
        </div>
      </div>

      <!-- Footer -->
      <div class="border-t border-slate-700 bg-slate-800/50 px-4 py-3">
        <div class="flex items-center justify-between">
          <span class="text-xs text-slate-500"> {{ templates().length }} templates </span>
          <button
            type="button"
            class="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300"
            (click)="onCreateCustom()"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
            Create custom template
          </button>
        </div>
      </div>
    </div>
  `,
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
