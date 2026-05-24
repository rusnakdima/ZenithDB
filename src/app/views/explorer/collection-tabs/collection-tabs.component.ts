import { Component, input, output } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";

interface Tab {
  name: string;
  collection: string;
}

@Component({
  selector: "app-collection-tabs",
  standalone: true,
  imports: [MatIconModule],
  templateUrl: "./collection-tabs.component.html",
})
export class CollectionTabsComponent {
  tabs = input<Tab[]>([]);
  activeCollection = input<string>("");

  tabSelect = output<string>();
  tabClose = output<string>();

  onCloseTab(collection: string) {
    this.tabClose.emit(collection);
  }
}
