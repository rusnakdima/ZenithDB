import { Component } from "@angular/core";
import { SidebarComponent } from "@layout/sidebar/sidebar.component";
import { HeaderComponent } from "@layout/header/header.component";
import { RouterOutlet } from "@angular/router";

@Component({
  selector: "app-main-layout",
  standalone: true,
  imports: [SidebarComponent, HeaderComponent, RouterOutlet],
  templateUrl: "./main-layout.component.html",
})
export class MainLayoutComponent {}
