import { Component, input, output, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ModalComponent } from "@shared/components/modal/modal.component";

export type CollectionType = "json" | "mongodb" | "mysql" | "postgres" | "sqlite" | "redis";

@Component({
  selector: "app-collection-create-dialog",
  standalone: true,
  imports: [ModalComponent, FormsModule],
  templateUrl: "./collection-create-dialog.component.html",
})
export class CollectionCreateDialogComponent {
  open = input<boolean>(false);

  created = output<{ name: string; type: CollectionType }>();
  cancelled = output<void>();

  collectionName = signal("");
  collectionType = signal<CollectionType>("json");

  readonly collectionTypes: { value: CollectionType; label: string }[] = [
    { value: "json", label: "JSON File" },
    { value: "mongodb", label: "MongoDB" },
    { value: "mysql", label: "MySQL" },
    { value: "postgres", label: "PostgreSQL" },
    { value: "sqlite", label: "SQLite" },
    { value: "redis", label: "Redis" },
  ];

  get isValid(): boolean {
    return this.collectionName().trim().length > 0;
  }

  onNameInput(event: Event): void {
    this.collectionName.set((event.target as HTMLInputElement).value);
  }

  onTypeChange(event: Event): void {
    this.collectionType.set((event.target as HTMLSelectElement).value as CollectionType);
  }

  onCreate(): void {
    if (this.isValid) {
      this.created.emit({
        name: this.collectionName().trim(),
        type: this.collectionType(),
      });
      this.reset();
    }
  }

  onCancel(): void {
    this.reset();
    this.cancelled.emit();
  }

  onClosed(): void {
    this.reset();
  }

  private reset(): void {
    this.collectionName.set("");
    this.collectionType.set("json");
  }
}
