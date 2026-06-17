import { Component, Input, Output, EventEmitter, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { PipelineStage, StageType, StageConfig } from "./pipeline-builder.service";
import { MatchConfigComponent } from "./stage-config/match-config.component";
import { GroupConfigComponent } from "./stage-config/group-config.component";
import { SortConfigComponent } from "./stage-config/sort-config.component";
import { ProjectConfigComponent } from "./stage-config/project-config.component";
import { LimitConfigComponent } from "./stage-config/limit-config.component";
import { logger } from "../../../services/logger.service";

@Component({
  selector: "app-pipeline-stage",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatchConfigComponent,
    GroupConfigComponent,
    SortConfigComponent,
    ProjectConfigComponent,
    LimitConfigComponent,
  ],
  templateUrl: "./pipeline-stage.component.html",
  /* // template: `
    <div class="rounded-lg border border-slate-600 bg-slate-800/50">
      <!-- Stage Header -->
      <div class="flex items-center gap-3 border-b border-slate-600 px-4 py-3">
        <div class="flex items-center gap-2">
          <span
            class="rounded bg-[var(--accent-muted)] px-2 py-1 text-xs font-medium text-[var(--accent)]"
          >
            {{ stage.type }}
          </span>
        </div>

        <div class="ml-auto flex items-center gap-1">
          <button
            type="button"
            class="rounded p-1 text-slate-500 transition-colors hover:bg-slate-700 hover:text-white"
            (click)="onMoveUp()"
            title="Move up"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 15l7-7 7 7"
              />
            </svg>
          </button>
          <button
            type="button"
            class="rounded p-1 text-slate-500 transition-colors hover:bg-slate-700 hover:text-white"
            (click)="onMoveDown()"
            title="Move down"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
          <button
            type="button"
            class="rounded p-1 text-slate-500 transition-colors hover:bg-slate-700 hover:text-red-400"
            (click)="onRemove()"
            title="Remove stage"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      <!-- Stage Config -->
      <div class="p-4">
        @switch (stage.type) {
          @case ("$match") {
            <app-match-config
              [config]="asMatchConfig()"
              [collectionName]="collectionName"
              (configChange)="onConfigChange($event)"
            />
          }
          @case ("$group") {
            <app-group-config
              [config]="asGroupConfig()"
              [collectionName]="collectionName"
              (configChange)="onConfigChange($event)"
            />
          }
          @case ("$sort") {
            <app-sort-config
              [config]="asSortConfig()"
              [collectionName]="collectionName"
              (configChange)="onConfigChange($event)"
            />
          }
          @case ("$skip") {
            <app-limit-config
              [config]="asSkipLimitConfig()"
              (configChange)="onConfigChange($event)"
            />
          }
          @case ("$limit") {
            <app-limit-config
              [config]="asSkipLimitConfig()"
              (configChange)="onConfigChange($event)"
            />
          }
          @case ("$project") {
            <app-project-config
              [config]="asProjectConfig()"
              [collectionName]="collectionName"
              (configChange)="onConfigChange($event)"
            />
          }
          @case ("$replaceRoot") {
            <div class="space-y-2">
              <label class="text-xs tracking-wide text-slate-400 uppercase"
                >New Root Expression</label
              >
              <textarea
                class="w-full rounded border border-slate-600 bg-slate-700 px-3 py-2 font-mono text-sm text-slate-200 focus:border-[var(--accent)] focus:outline-none"
                rows="4"
                placeholder='{ "$field": "$value" }'
                [ngModel]="asReplaceRootConfig().expression"
                (ngModelChange)="onReplaceRootChange($event)"
              ></textarea>
            </div>
          }
        }
      </div>
    </div>
  ` */
})
export class PipelineStageComponent {
  

  @Input() stage!: PipelineStage;
  @Input() collectionName = "";
  @Input() index = 0;
  @Input() totalCount = 1;

  @Output() remove = new EventEmitter<void>();
  @Output() moveUp = new EventEmitter<void>();
  @Output() moveDown = new EventEmitter<void>();
  @Output() configChange = new EventEmitter<StageConfig>();

  onRemove(): void {
    logger.debug("[SEARCH_PIPELINE]", "Pipeline stage removed", {
      stageType: this.stage.type,
    });
    this.remove.emit();
  }

  onMoveUp(): void {
    logger.debug("[SEARCH_PIPELINE]", "Pipeline stage move up", { index: this.index });
    this.moveUp.emit();
  }

  onMoveDown(): void {
    logger.debug("[SEARCH_PIPELINE]", "Pipeline stage move down", { index: this.index });
    this.moveDown.emit();
  }

  onConfigChange(config: StageConfig): void {
    logger.debug("[SEARCH_PIPELINE]", "Pipeline stage config changed", {
      stageType: this.stage.type,
    });
    this.configChange.emit(config);
  }

  onReplaceRootChange(expression: string): void {
    logger.debug("[SEARCH_PIPELINE]", "ReplaceRoot expression changed");
    this.configChange.emit({ expression });
  }

  asMatchConfig(): import("./pipeline-builder.service").MatchConfig {
    return this.stage.config as import("./pipeline-builder.service").MatchConfig;
  }

  asGroupConfig(): import("./pipeline-builder.service").GroupConfig {
    return this.stage.config as import("./pipeline-builder.service").GroupConfig;
  }

  asSortConfig(): import("./pipeline-builder.service").SortStageConfig {
    return this.stage.config as import("./pipeline-builder.service").SortStageConfig;
  }

  asSkipLimitConfig(): import("./pipeline-builder.service").SkipLimitConfig {
    return this.stage.config as import("./pipeline-builder.service").SkipLimitConfig;
  }

  asProjectConfig(): import("./pipeline-builder.service").ProjectConfig {
    return this.stage.config as import("./pipeline-builder.service").ProjectConfig;
  }

  asReplaceRootConfig(): import("./pipeline-builder.service").ReplaceRootConfig {
    return this.stage.config as import("./pipeline-builder.service").ReplaceRootConfig;
  }
}
