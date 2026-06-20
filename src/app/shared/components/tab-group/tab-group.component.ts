import { Component, input, output } from "@angular/core";
import { CommonModule } from "@angular/common";
@Component({
  selector: "app-tab-group",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./tab-group.component.html",
})
export class TabGroupComponent {
  tabs = input.required<{ id: string; label: string }[]>();
  activeTab = input.required<string>();
  tabChange = output<string>();
  switchTab(tabId: string) {
    this.tabChange.emit(tabId);
  }
}
