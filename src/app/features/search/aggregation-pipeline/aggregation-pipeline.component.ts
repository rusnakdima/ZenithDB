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
import { AppLoggerService } from "@shared/services/app-logger.service";

@Component({
  selector: "app-aggregation-pipeline",
  standalone: true,
  imports: [CommonModule, FormsModule, PipelineStageComponent, PipelineJsonEditorComponent],
  templateUrl: "./aggregation-pipeline.component.html",
})
export class AggregationPipelineComponent implements OnInit {
  readonly pipelineService = inject(PipelineBuilderService);
  private logger = inject(AppLoggerService);

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

  pipelineJson = signal("[]");
  jsonError = signal<string | null>(null);

  private isInternalChange = false;

  constructor() {
    effect(() => {
      if (!this.isInternalChange) {
        const json = this.pipelineService.toJson();
        this.pipelineJson.set(json);
      }
    });
  }

  ngOnInit(): void {
    this.logger.debug("[SEARCH_PIPELINE]", "Aggregation pipeline component initialized", {
      collectionName: this.collectionName,
    });
  }

  addStage(type: StageType): void {
    this.logger.debug("[SEARCH_PIPELINE]", "Adding stage", { type });
    this.pipelineService.addStage(type);
    this.updateJsonFromStages();
  }

  removeStage(id: string): void {
    this.logger.debug("[SEARCH_PIPELINE]", "Removing stage", { id });
    this.pipelineService.removeStage(id);
    this.updateJsonFromStages();
  }

  moveStageUp(index: number): void {
    this.pipelineService.moveStageUp(index);
    this.updateJsonFromStages();
  }

  moveStageDown(index: number): void {
    this.pipelineService.moveStageDown(index);
    this.updateJsonFromStages();
  }

  updateStageConfig(id: string, config: StageConfig): void {
    this.pipelineService.updateStageConfig(id, config);
    this.updateJsonFromStages();
  }

  clearAll(): void {
    this.logger.info("[SEARCH_PIPELINE]", "Clearing all pipeline stages");
    this.pipelineService.clearAll();
    this.updateJsonFromStages();
  }

  onJsonChange(json: string): void {
    this.isInternalChange = true;
    this.pipelineJson.set(json);

    if (!this.jsonError()) {
      const success = this.pipelineService.fromJson(json);
      if (success) {
        this.updateJsonFromStages();
      }
    }
    this.isInternalChange = false;
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

  private updateJsonFromStages(): void {
    this.isInternalChange = true;
    const json = this.pipelineService.toJson();
    this.pipelineJson.set(json);
    this.isInternalChange = false;
  }
}
