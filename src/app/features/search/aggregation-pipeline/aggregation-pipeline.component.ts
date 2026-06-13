import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
  inject,
  OnInit,
  effect,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import {
  PipelineBuilderService,
  StageType,
  PipelineStage,
  StageConfig,
} from "./pipeline-builder.service";
import { PipelineStageComponent } from "./pipeline-stage.component";
import { PipelineJsonEditorComponent } from "./pipeline-json-editor.component";
import { LoggingService } from "@shared/services/logging.service";

@Component({
  selector: "app-aggregation-pipeline",
  standalone: true,
  imports: [CommonModule, FormsModule, PipelineStageComponent, PipelineJsonEditorComponent],
  templateUrl: "./aggregation-pipeline.component.html",
})
export class AggregationPipelineComponent implements OnInit {
  readonly pipelineService = inject(PipelineBuilderService);
  private logger = inject(LoggingService);

  @Input() collectionName = "";
  @Output() cancel = new EventEmitter<void>();
  @Output() execute = new EventEmitter<object[]>();

  availableStages: StageType[] = [
    "$match",
    "$group",
    "$sort",
    "$skip",
    "$limit",
    "$project",
    "$replaceRoot",
  ];

  pipelineJson = computed(() => this.pipelineService.toJson());
  jsonError = signal<string | null>(null);

  ngOnInit(): void {
    this.logger.debug("[SEARCH_PIPELINE]", "Aggregation pipeline component initialized", {
      collectionName: this.collectionName,
    });
  }

  addStage(type: StageType): void {
    this.logger.debug("[SEARCH_PIPELINE]", "Adding stage", { type });
    this.pipelineService.addStage(type);
  }

  removeStage(id: string): void {
    this.logger.debug("[SEARCH_PIPELINE]", "Removing stage", { id });
    this.pipelineService.removeStage(id);
  }

  moveStageUp(index: number): void {
    this.pipelineService.moveStageUp(index);
  }

  moveStageDown(index: number): void {
    this.pipelineService.moveStageDown(index);
  }

  updateStageConfig(id: string, config: StageConfig): void {
    this.pipelineService.updateStageConfig(id, config);
  }

  clearAll(): void {
    this.logger.info("[SEARCH_PIPELINE]", "Clearing all pipeline stages");
    this.pipelineService.clearAll();
  }

  onJsonChange(json: string): void {
    if (!this.jsonError()) {
      this.pipelineService.fromJson(json);
    }
  }

  onParseError(error: string | null): void {
    this.jsonError.set(error);
  }

  onCancel(): void {
    this.logger.debug("[SEARCH_PIPELINE]", "Pipeline execution cancelled");
    this.cancel.emit();
  }

  onExecute(): void {
    const pipeline = this.pipelineService.buildPipeline();
    this.logger.info("[SEARCH_PIPELINE]", "Executing aggregation pipeline", { pipeline });
    this.execute.emit(pipeline);
  }
}
