import { Component, input, output } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { SplitMode } from "@shared/services/persistent-storage.service";
type ViewTab = "table" | "tree" | "json";
@Component({
  selector: "app-view-switcher",
  standalone: true,
  imports: [MatIconModule],
  templateUrl: "./view-switcher.component.html",
})
export class ViewSwitcherComponent {
  activeView = input<ViewTab>("table");
  splitMode = input<SplitMode>("none");
  viewChange = output<ViewTab>();
  splitChange = output<SplitMode>();
  viewTabs: { id: ViewTab; label: string }[] = [
    { id: "table", label: "Table View" },
    { id: "tree", label: "Tree View" },
    { id: "json", label: "JSON View" },
  ];
  splitModes: { id: SplitMode; label: string; icon: string }[] = [
    { id: "none", label: "No Split", icon: "view_column" },
    { id: "horizontal", label: "Horizontal", icon: "vertical_split" },
    { id: "vertical", label: "Vertical", icon: "horizontal_split" },
  ];
}
