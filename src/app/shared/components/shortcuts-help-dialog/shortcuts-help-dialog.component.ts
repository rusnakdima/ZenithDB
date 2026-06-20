import { Component, inject, HostListener, computed, signal } from "@angular/core";
import { ModalComponent } from "@shared/components/modal/modal.component";
import { KeyboardShortcutsService } from "@shared/services/keyboard-shortcuts.service";
import { KbdBadgeComponent } from "@shared/components/kbd-badge/kbd-badge.component";
@Component({
  selector: "app-shortcuts-help-dialog",
  standalone: true,
  imports: [ModalComponent, KbdBadgeComponent],
  templateUrl: "./shortcuts-help-dialog.component.html",
})
export class ShortcutsHelpDialogComponent {
  private shortcutsService = inject(KeyboardShortcutsService);
  isOpen = signal(false);
  shortcutsByCategory = computed(() => this.shortcutsService.getShortcutsByCategory());
  navigationShortcuts = computed(() => this.shortcutsByCategory().navigation);
  editorShortcuts = computed(() => this.shortcutsByCategory().editor);
  @HostListener("document:zenith:show-shortcuts")
  show(): void {
    this.isOpen.set(true);
  }
  onClose(): void {
    this.isOpen.set(false);
  }
}
