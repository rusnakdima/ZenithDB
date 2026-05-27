import { Component, input, output } from "@angular/core";
import { SchemaTreeComponent } from "@features/schema/schema-tree/schema-tree.component";

@Component({
  selector: "app-explorer-sidebar",
  standalone: true,
  imports: [SchemaTreeComponent],
  templateUrl: "./explorer-sidebar.component.html",
})
export class ExplorerSidebarComponent {
  collapsed = input<boolean>(false);
  collectionSelect = output<string>();
}
