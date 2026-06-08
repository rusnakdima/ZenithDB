import { Component, Input, Output, EventEmitter } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { QueryGroupComponent } from "../../../query/visual-query-builder/query-group/query-group.component";
import { MatchConfig } from "../pipeline-builder.service";
import { ConditionGroup } from "../../../query/models";

@Component({
  selector: "app-match-config",
  standalone: true,
  imports: [CommonModule, FormsModule, QueryGroupComponent],
  template: `
    <div class="space-y-3">
      <div class="text-xs tracking-wide text-slate-400 uppercase">Match Conditions</div>
      <app-query-group
        [group]="config.conditionGroup"
        [collectionName]="collectionName"
        [isNested]="false"
        [isRoot]="true"
        (groupChange)="onGroupChange($event)"
      />
    </div>
  `,
})
export class MatchConfigComponent {
  @Input() config!: MatchConfig;
  @Input() collectionName = "";
  @Output() configChange = new EventEmitter<MatchConfig>();

  onGroupChange(group: ConditionGroup): void {
    this.configChange.emit({
      ...this.config,
      conditionGroup: group,
    });
  }
}
