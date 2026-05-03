import { Component, inject, signal, HostListener } from "@angular/core";
import { KeyboardShortcutsService } from "@shared/services/keyboard-shortcuts.service";

@Component({
  selector: "app-shortcuts-help-dialog",
  standalone: true,
  templateUrl: "./shortcuts-help-dialog.component.html",
})
export class ShortcutsHelpDialogComponent {
  private shortcutsService = inject(KeyboardShortcutsService);

  visible = signal(false);

  @HostListener("document:zenith:show-shortcuts")
  show(): void {
    this.visible.set(true);
  }

  @HostListener("document:keydown.escape")
  onEscape(): void {
    if (this.visible()) {
      this.hide();
    }
  }

  hide(): void {
    this.visible.set(false);
  }

  onOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains("overlay")) {
      this.hide();
    }
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