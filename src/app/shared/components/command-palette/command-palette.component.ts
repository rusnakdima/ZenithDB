import {
  Component,
  inject,
  signal,
  computed,
  HostListener,
  ElementRef,
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { CommandPaletteService } from "./command-palette.service";
import { Command } from "./command.model";

@Component({
  selector: "app-command-palette",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: "./command-palette.component.html",
})
export class CommandPaletteComponent implements AfterViewInit {
  private cdr = inject(ChangeDetectorRef);
  private service = inject(CommandPaletteService);
  private elementRef = inject(ElementRef);

  isOpen = signal(false);
  query = signal("");
  selectedIndex = signal(0);

  private inputElement: HTMLInputElement | null = null;

  selectableCommands = computed(() => {
    return this.filteredCommands().filter((c) => !this.isHeader(c));
  });

  filteredCommands = computed(() => {
    const q = this.query().toLowerCase();
    const recent = this.service.getRecent();

    if (!q) {
      const recentIds = recent.map((c) => c.id);
      const nonRecent = this.service.commands.filter((c) => !recentIds.includes(c.id));

      const result: Command[] = [
        { id: "recent-header", label: "", category: "recent" as const, action: () => {} },
        ...recent,
        { id: "nav-header", label: "", category: "navigation" as const, action: () => {} },
        ...nonRecent.filter((c) => c.category === "navigation"),
        { id: "action-header", label: "", category: "action" as const, action: () => {} },
        ...nonRecent.filter((c) => c.category === "action"),
      ];
      return result;
    }

    return this.service.filterCommands(q);
  });

  ngAfterViewInit(): void {
    this.inputElement = this.elementRef.nativeElement.querySelector("input");
  }

  @HostListener("document:keydown", ["$event"])
  handleKeyDown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && (event.key === "k" || event.key === "p")) {
      event.preventDefault();
      this.open();
      return;
    }

    if (!this.isOpen()) return;

    if (event.key === "Escape") {
      event.preventDefault();
      this.close();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      this.moveSelection(1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      this.moveSelection(-1);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      this.executeSelected();
      return;
    }
  }

  @HostListener("document:zenith:open-command-palette")
  open(): void {
    this.isOpen.set(true);
    this.query.set("");
    this.selectedIndex.set(0);
    setTimeout(() => this.inputElement?.focus(), 50);
  }

  close(): void {
    this.isOpen.set(false);
    this.query.set("");
    this.selectedIndex.set(0);
  }

  onQueryChange(value: string): void {
    this.query.set(value);
    this.selectedIndex.set(0);
  }

  execute(command: Command): void {
    if (command.id.includes("-header") || !command.action) return;
    this.service.addToRecent(command);
    command.action();
    this.close();
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains("command-palette-backdrop")) {
      this.close();
    }
  }

  isHeader(command: Command): boolean {
    return command.id.includes("-header");
  }

  isSelected(command: Command): boolean {
    const selectable = this.selectableCommands();
    const idx = selectable.indexOf(command);
    return idx === this.selectedIndex();
  }

  getCategoryLabel(category: string): string {
    switch (category) {
      case "recent":
        return "Recent";
      case "navigation":
        return "Navigation";
      case "action":
        return "Actions";
      default:
        return "";
    }
  }

  highlightMatch(label: string): string {
    const q = this.query().toLowerCase();
    if (!q) return label;

    const lowerLabel = label.toLowerCase();
    const index = lowerLabel.indexOf(q);

    if (index === -1) return label;

    return (
      label.substring(0, index) +
      "<mark class='bg-emerald-500/30 text-emerald-400'>" +
      label.substring(index, index + q.length) +
      "</mark>" +
      label.substring(index + q.length)
    );
  }

  private moveSelection(delta: number): void {
    const commands = this.selectableCommands();
    const newIndex = this.selectedIndex() + delta;
    this.selectedIndex.set(Math.max(0, Math.min(newIndex, commands.length - 1)));
  }

  private executeSelected(): void {
    const commands = this.selectableCommands();
    const selected = commands[this.selectedIndex()];
    if (selected) {
      this.execute(selected);
    }
  }
}
