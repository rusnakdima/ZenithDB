import { Component, input, output } from "@angular/core";
import { DataTableGridComponent } from "@features/data/data-table-grid/data-table-grid.component";
import { PaginationComponent } from "@shared/components/pagination/pagination.component";
import { ColumnInfo, RowData } from "@shared/models/connection.config";

@Component({
  selector: "app-table-view",
  standalone: true,
  imports: [DataTableGridComponent, PaginationComponent],
  templateUrl: "./table-view.component.html",
})
export class TableViewComponent {
  collectionName = input<string>("");
  filter = input<string>("");
  page = input(0);
  pageSize = input(25);
  inputVisibleColumns = input<string[]>([]);
  columns = input<ColumnInfo[]>([]);
  reloadTrigger = input<number>(0);
  totalItems = input<number>(0);

  documentClick = output<RowData>();
  pageChange = output<number>();
  pageSizeChange = output<number>();
  columnsOrderChange = output<string[]>();
}
