import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
  inject,
  OnInit,
  OnChanges,
  SimpleChanges,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { QueryGroupComponent } from "./query-group/query-group.component";
import { ConditionGroup, SortConfig, createEmptyGroup } from "../models";
import { FilterBuilderService, SchemaCompletionService } from "../services";
import { FilterExpression } from "@app/models/connection.config";
import { logger } from "@core/services/logger.service";

@Component({
  selector: "app-visual-query-builder",
  standalone: true,
  imports: [CommonModule, FormsModule, QueryGroupComponent],
  templateUrl: "./visual-query-builder.component.html",
})
export class VisualQueryBuilderComponent implements OnInit, OnChanges {
  private readonly filterBuilder = inject(FilterBuilderService);
  private readonly schemaCompletion = inject(SchemaCompletionService);

  @Input() collectionName = "";
  @Input() initialFilter: FilterExpression | null = null;
  @Input() initialSort: SortConfig[] = [];
  @Input() initialSkip: number | null = null;
  @Input() initialLimit: number | null = null;

  @Output() filterChange = new EventEmitter<FilterExpression>();
  @Output() sortChange = new EventEmitter<SortConfig[]>();
  @Output() paginationChange = new EventEmitter<{ skip: number | null; limit: number | null }>();
  @Output() cancel = new EventEmitter<void>();
  @Output() apply = new EventEmitter<{
    filter: FilterExpression | null;
    sort: SortConfig[];
    skip: number | null;
    limit: number | null;
  }>();

  rootGroup = signal<ConditionGroup>(createEmptyGroup());
  sorts = signal<SortConfig[]>([]);
  skip = signal<number | null>(null);
  limit = signal<number | null>(null);
  fields = signal<{ name: string; type: string }[]>([]);

  hasConditions = computed(() => {
    const group = this.rootGroup();
    return group.conditions.length > 0 || (group.groups?.length ?? 0) > 0;
  });

  conditionCount = computed(() => {
    const group = this.rootGroup();
    return this.countConditions(group);
  });

  ngOnInit(): void {
    this.loadFields();
    this.initializeFromInputs();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["initialFilter"] && !changes["initialFilter"].firstChange) {
      this.initializeFilter();
    }
  }

  private async loadFields(): Promise<void> {
    if (this.collectionName) {
      const fields = await this.schemaCompletion.getFields(this.collectionName);
      this.fields.set(fields);
    }
  }

  private initializeFromInputs(): void {
    if (this.initialFilter) {
      this.initializeFilter();
    }
    if (this.initialSort.length > 0) {
      this.sorts.set([...this.initialSort]);
    }
    if (this.initialSkip !== null) {
      this.skip.set(this.initialSkip);
    }
    if (this.initialLimit !== null) {
      this.limit.set(this.initialLimit);
    }
  }

  private initializeFilter(): void {
    if (this.initialFilter) {
      const groups = this.filterBuilder.parseFilter(this.initialFilter);
      if (groups.length > 0) {
        this.rootGroup.set(groups[0]);
      }
    }
  }

  private countConditions(group: ConditionGroup): number {
    let count = group.conditions.length;
    if (group.groups) {
      for (const subGroup of group.groups) {
        count += this.countConditions(subGroup);
      }
    }
    return count;
  }

  onGroupChange(group: ConditionGroup): void {
    this.rootGroup.set(group);
  }

  addSort(): void {
    this.sorts.update((s) => [...s, { field: "", direction: "asc" }]);
  }

  updateSortField(index: number, field: string): void {
    this.sorts.update((sorts) => {
      const newSorts = [...sorts];
      newSorts[index] = { ...newSorts[index], field };
      return newSorts;
    });
  }

  toggleSortDirection(index: number): void {
    this.sorts.update((sorts) => {
      const newSorts = [...sorts];
      newSorts[index] = {
        ...newSorts[index],
        direction: newSorts[index].direction === "asc" ? "desc" : "asc",
      };
      return newSorts;
    });
  }

  removeSort(index: number): void {
    this.sorts.update((sorts) => sorts.filter((_, i) => i !== index));
  }

  clearAll(): void {
    this.rootGroup.set(createEmptyGroup());
    this.sorts.set([]);
    this.skip.set(null);
    this.limit.set(null);
  }

  onCancel(): void {
    this.cancel.emit();
  }

  onApply(): void {
    logger.debug("[QUERY]", "Visual query builder apply");
    const filter = this.filterBuilder.buildFilter([this.rootGroup()]);
    const validSorts = this.sorts().filter((s) => s.field);

    this.apply.emit({
      filter: filter ?? null,
      sort: validSorts,
      skip: this.skip(),
      limit: this.limit(),
    });
  }
}
