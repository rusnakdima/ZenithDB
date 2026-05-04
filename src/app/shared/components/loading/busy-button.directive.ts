import { Component, Input, HostBinding, ElementRef, Renderer2 } from "@angular/core";

@Component({
  selector: "button[appBusyButton]",
  standalone: true,
  templateUrl: "./busy-button.directive.html",
})
export class BusyButtonDirective {
  @Input() isLoading: boolean = false;

  @HostBinding("disabled")
  get disabled(): boolean {
    return this.isLoading;
  }

  @HostBinding("class")
  get hostClass(): string {
    return "relative inline-flex items-center justify-center";
  }
}
