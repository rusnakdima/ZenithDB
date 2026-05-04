import { Component, inject, HostListener } from "@angular/core";
import { ModalComponent } from "@shared/components/modal/modal.component";
import { KeyboardShortcutsService } from "@shared/services/keyboard-shortcuts.service";

@Component({
  selector: "app-shortcuts-help-dialog",
  standalone: true,
  imports: [ModalComponent],
  templateUrl: "./shortcuts-help-dialog.component.html",
})
export class ShortcutsHelpDialogComponent {
  private shortcutsService = inject(KeyboardShortcutsService);

  isOpen = false;

  @HostListener("document:zenith:show-shortcuts")
  show(): void {
    this.isOpen = true;
  }

  onClose(): void {
    this.isOpen = false;
  }

  get shortcutsByCategory() {
    return this.shortcutsService.getShortcutsByCategory();
  }

  get navigationShortcuts() {
    return this.shortcutsByCategory.navigation;
  }

  get editorShortcuts() {
    return this.shortcutsByCategory.editor;
  }
}
