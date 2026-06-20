import { Component, Input, Output, EventEmitter, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
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
  }
  @Output() createIndex = new EventEmitter<void>();
  @Output() acceptRecommendation = new EventEmitter<unknown>();
  @Output() dismissRecommendation = new EventEmitter<unknown>();
  private _recommendations: unknown[] = [];
  onAcceptRecommendation(recommendation: unknown): void {
    this.acceptRecommendation.emit(recommendation);
  }
  onDismissRecommendation(recommendation: unknown): void {
    this.dismissRecommendation.emit(recommendation);
  }
  onCreateIndex(): void {
    this.createIndex.emit();
  }
}
