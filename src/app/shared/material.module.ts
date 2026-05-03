import { NgModule } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { MatCheckboxModule } from "@angular/material/checkbox";

const materialModules = [
  MatIconModule,
  MatCheckboxModule,
];

@NgModule({
  imports: materialModules,
  exports: materialModules,
})
export class AppMaterialModule {}
