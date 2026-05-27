import { Component, input, output, signal } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { SchemaTreeComponent } from "@features/schema/schema-tree/schema-tree.component";

@Component({
  selector: "app-explorer-sidebar",
  standalone: true,
  imports: [MatIconModule, SchemaTreeComponent],
  templateUrl: "./explorer-sidebar.component.html",
})
export class ExplorerSidebarComponent {
  collapsed = input<boolean>(false);
  collectionSelect = output<string>();
}
