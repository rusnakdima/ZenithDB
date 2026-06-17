import { Component, Input, Output, EventEmitter, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { QueryGroupComponent } from "../../../query/visual-query-builder/query-group/query-group.component";
import { MatchConfig } from "../pipeline-builder.service";
import { ConditionGroup } from "../../../query/models";
import { logger } from "../../../../services/logger.service";

@Component({
  selector: "app-match-config",
  standalone: true,
  imports: [CommonModule, FormsModule, QueryGroupComponent],
  templateUrl: "./match-config.component.html",
})
export class MatchConfigComponent {
  @Input() config!: MatchConfig;
  @Input() collectionName = "";
  @Output() configChange = new EventEmitter<MatchConfig>();

  onGroupChange(group: ConditionGroup): void {
    logger.debug("[SEARCH_PIPELINE]", "Match config changed", { group });
    this.configChange.emit({
      ...this.config,
      conditionGroup: group,
    });
  }
}
