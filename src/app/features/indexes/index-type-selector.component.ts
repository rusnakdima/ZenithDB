import { Component, Input, Output, EventEmitter, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { IndexType } from "./create-index-dialog.component";
import { logger } from "@core/services/logger.service";

interface IndexTypeOption {
  type: IndexType;
  label: string;
  description: string;
  icon: string;
}

const INDEX_TYPES: IndexTypeOption[] = [
  {
    type: "single",
    label: "Single Field",
    description: "Index on a single field",
    icon: "1",
  },
  {
    type: "compound",
    label: "Compound",
    description: "Index on multiple fields",
    icon: "1..n",
  },
  {
    type: "text",
    label: "Text",
    description: "Full-text search index",
    icon: "Aa",
  },
  {
    type: "geospatial",
    label: "Geospatial",
    description: "Location-based index",
    icon: "geo",
  },
  {
    type: "ttl",
    label: "TTL",
    description: "Time-to-live index",
    icon: "24h",
  },
  {
    type: "hashed",
    label: "Hashed",
    description: "Hash-based index",
    icon: "#",
  },
];

@Component({
  selector: "app-index-type-selector",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./index-type-selector.component.html",
})
export class IndexTypeSelectorComponent {
  @Input() selectedType: IndexType = "single";
  @Output() typeChange = new EventEmitter<IndexType>();

  indexTypes = INDEX_TYPES;

  onTypeSelect(type: IndexType): void {
    logger.debug("[INDEX]", "Index type selected", { type });
    this.typeChange.emit(type);
  }

  isSelected(type: IndexType): boolean {
    return this.selectedType === type;
  }
}
