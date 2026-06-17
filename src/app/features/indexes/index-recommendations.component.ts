import { Component, Input, Output, EventEmitter, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { logger } from "../../services/logger.service";

@Component({
  selector: "app-index-recommendations",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./index-recommendations.component.html",
})
export class IndexRecommendationsComponent {
  @Input() collectionName = "";
  @Input() set recommendations(value: unknown[]) {
    this._recommendations = value;
    logger.debug("[IndexRecommendations]", "Recommendations loaded", {
      count: value.length,
      collection: this.collectionName,
    });
  }
  @Output() createIndex = new EventEmitter<void>();
  @Output() acceptRecommendation = new EventEmitter<unknown>();
  @Output() dismissRecommendation = new EventEmitter<unknown>();

  private _recommendations: unknown[] = [];

  onAcceptRecommendation(recommendation: unknown): void {
    logger.info("[IndexRecommendations]", "Recommendation accepted", {
      collection: this.collectionName,
    });
    this.acceptRecommendation.emit(recommendation);
  }

  onDismissRecommendation(recommendation: unknown): void {
    logger.debug("[IndexRecommendations]", "Recommendation dismissed", {
      collection: this.collectionName,
    });
    this.dismissRecommendation.emit(recommendation);
  }

  onCreateIndex(): void {
    logger.info("[IndexRecommendations]", "Index creation initiated from recommendation", {
      collection: this.collectionName,
    });
    this.createIndex.emit();
  }
}
