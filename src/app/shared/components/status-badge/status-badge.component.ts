import { Component, input } from "@angular/core";

@Component({
  selector: "app-status-badge",
  standalone: true,
  template: `
    @if (status() === "connected") {
      <span
        class="inline-block rounded border border-green-500/30 bg-green-500/20 px-2 py-0.5 text-[10px] font-bold text-green-400"
        >CONNECTED</span
      >
    } @else if (status() === "offline") {
      <span
        class="inline-block rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-500"
        >OFFLINE</span
      >
    }
  `,
})
export class StatusBadgeComponent {
  status = input.required<"connected" | "offline">();
  size = input<"sm" | "md">();
}
