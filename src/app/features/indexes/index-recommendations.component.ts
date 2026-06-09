import { Component, Input, Output, EventEmitter } from "@angular/core";
import { CommonModule } from "@angular/common";

@Component({
  selector: "app-index-recommendations",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./index-recommendations.component.html",
})
export class IndexRecommendationsComponent {
  @Input() collectionName = "";
  @Output() createIndex = new EventEmitter<void>();
}
