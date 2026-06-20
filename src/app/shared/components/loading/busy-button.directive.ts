import {
  Directive,
  Input,
  HostBinding,
  ElementRef,
  Renderer2,
  OnInit,
  OnChanges,
} from "@angular/core";
@Directive({
  selector: "[busyButton]",
  standalone: true,
})
export class BusyButtonDirective implements OnInit, OnChanges {
  @Input() busy = false;
  @Input() busyText = "Loading...";
  @HostBinding("disabled")
  get isDisabled(): boolean {
    return this.busy;
  }
  private originalInnerHTML: string = "";
  constructor(
    private el: ElementRef<HTMLButtonElement>,
    private renderer: Renderer2
  ) {}
  ngOnInit(): void {
    this.originalInnerHTML = this.el.nativeElement.innerHTML;
    this.updateContent();
  }
  ngOnChanges(): void {
    if (this.originalInnerHTML) {
      this.updateContent();
    }
  }
  private updateContent(): void {
    if (this.busy) {
      this.el.nativeElement.innerHTML = `
        <span class="flex items-center justify-center gap-2">
          <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          ${this.busyText}
        </span>
      `;
    } else {
      this.el.nativeElement.innerHTML = this.originalInnerHTML;
    }
  }
}
