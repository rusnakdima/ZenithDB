import { Component, Input, Output, EventEmitter } from "@angular/core";
import { CommonModule } from "@angular/common";

@Component({
  selector: "app-index-recommendations",
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="rounded-lg border border-slate-600 bg-slate-800/50 p-4">
      <p class="text-sm text-slate-400">Index recommendations coming soon...</p>
    </div>
  `,
})
export class IndexRecommendationsComponent {
  @Input() collectionName = "";
  @Output() createIndex = new EventEmitter<void>();
}
