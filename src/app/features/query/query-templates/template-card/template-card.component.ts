import { Component, Input, Output, EventEmitter } from "@angular/core";
import { CommonModule } from "@angular/common";
import { QueryTemplate, TEMPLATE_CATEGORIES } from "../../models";

@Component({
  selector: "app-template-card",
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="group relative cursor-pointer rounded-lg border border-slate-700 bg-slate-800 p-4 transition-all hover:border-[var(--accent)]/50"
      (click)="select.emit(template)"
    >
      <!-- Favorite Button -->
      <button
        type="button"
        class="absolute top-3 right-3 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100"
        [class.text-amber-400]="isFavorite"
        [class.text-slate-500]="!isFavorite"
        [class.hover:text-amber-300]="!isFavorite"
        (click)="onFavoriteClick($event)"
      >
        <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
          @if (isFavorite) {
            <path
              d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            />
          } @else {
            <path
              d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
              stroke="currentColor"
              stroke-width="2"
              fill="none"
            />
          }
        </svg>
      </button>

      <!-- Icon and Title -->
      <div class="flex items-start gap-3">
        <div
          class="flex h-10 w-10 items-center justify-center rounded-lg"
          [class]="getCategoryColor()"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            @switch (template.icon) {
              @case ("list") {
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 6h16M4 10h16M4 14h16M4 18h16"
                />
              }
              @case ("search") {
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              }
              @case ("sort") {
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
                />
              }
              @case ("pagination") {
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 6h16M4 10h16M4 14h16M4 18h16"
                />
              }
              @case ("duplicate") {
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              }
              @case ("edit") {
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              }
              @case ("delete") {
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              }
              @case ("index") {
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              }
              @case ("text") {
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
                />
              }
              @default {
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              }
            }
          </svg>
        </div>

        <div class="min-w-0 flex-1">
          <h4 class="truncate text-sm font-medium text-slate-200">
            {{ template.name }}
          </h4>
          <p class="mt-1 line-clamp-2 text-xs text-slate-400">
            {{ template.description }}
          </p>
        </div>
      </div>

      <!-- Footer -->
      <div class="mt-3 flex items-center justify-between">
        <span class="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-400">
          {{ getCategoryLabel() }}
        </span>

        @if (template.isBuiltIn) {
          <span class="text-xs text-slate-500">Built-in</span>
        } @else {
          <span class="text-xs text-[var(--accent)]">Custom</span>
        }
      </div>
    </div>
  `,
})
export class TemplateCardComponent {
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
    event.stopPropagation();
    this.toggleFavorite.emit(this.template.id);
  }
}
