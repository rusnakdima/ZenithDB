import { Component, signal, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { fromEvent } from "rxjs";
import { filter } from "rxjs/operators";

interface Shortcut {
  icon: string;
  text: string;
  action: string;
}

@Component({
  selector: "app-command-palette",
  standalone: true,
  imports: [FormsModule],
  templateUrl: "./command-palette.component.html",
})
export class CommandPaletteComponent {
  visible = signal(false);
  query = "";

  private router = inject(Router);

  shortcuts: Shortcut[] = [
    { icon: "fa-table", text: "Go to Table", action: "orders" },
    { icon: "fa-bolt", text: "Run Explain Plan", action: "explain" },
    { icon: "fa-terminal", text: "Open Workbench", action: "workbench" },
    { icon: "fa-plug", text: "New Connection", action: "connection" },
  ];

  constructor() {
    fromEvent(document, "keydown")
      .pipe(filter((e: any) => (e.ctrlKey || e.metaKey) && e.key === "p"))
      .subscribe(() => this.visible.set(!this.visible()));
  }

  execute(action: string) {
    this.visible.set(false);
    this.query = "";
    switch (action) {
      case "orders":
        this.router.navigate(["/query"]);
        break;
      case "explain":
        this.router.navigate(["/query"]);
        break;
      case "workbench":
        this.router.navigate(["/query"]);
        break;
      case "connection":
        this.router.navigate(["/connections"]);
        break;
    }
  }

  hide() {
    this.visible.set(false);
    this.query = "";
  }

  onOverlayClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains("overlay")) {
      this.hide();
    }
  }
}
