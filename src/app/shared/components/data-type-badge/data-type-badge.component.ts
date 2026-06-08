import { Component, input, computed } from "@angular/core";
import { CommonModule } from "@angular/common";

type DataTypeBadgeVariant = "icon" | "class" | "full";

interface TypeConfig {
  icon: string;
  colorClass: string;
}

@Component({
  selector: "app-data-type-badge",
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (config(); as cfg) {
      @switch (variant()) {
        @case ("icon") {
          <span class="type-icon" [class]="cfg.colorClass">{{ cfg.icon }}</span>
        }
        @case ("class") {
          <span [class]="cfg.colorClass">{{ dataType() }}</span>
        }
        @case ("full") {
          <span class="type-icon" [class]="cfg.colorClass">{{ cfg.icon }}</span>
          <span [class]="cfg.colorClass">{{ dataType() }}</span>
        }
      }
    }
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
      }
      .type-icon {
        font-family: monospace;
        font-weight: 600;
        font-size: 0.75rem;
        padding: 0.125rem 0.375rem;
        border-radius: 0.25rem;
        background-color: rgba(255, 255, 255, 0.1);
      }
    `,
  ],
})
export class DataTypeBadgeComponent {
  dataType = input<string>("");
  variant = input<DataTypeBadgeVariant>("icon");

  private readonly _typeMap: Record<string, TypeConfig> = {
    string: { icon: "Aa", colorClass: "text-blue-400" },
    text: { icon: "Aa", colorClass: "text-blue-400" },
    number: { icon: "#", colorClass: "text-[var(--accent)]" },
    integer: { icon: "#", colorClass: "text-[var(--accent)]" },
    decimal: { icon: "#", colorClass: "text-[var(--accent)]" },
    float: { icon: "#", colorClass: "text-[var(--accent)]" },
    boolean: { icon: "T/F", colorClass: "text-[var(--accent)]" },
    date: { icon: "dt", colorClass: "text-purple-400" },
    datetime: { icon: "dt", colorClass: "text-purple-400" },
    timestamp: { icon: "dt", colorClass: "text-purple-400" },
    object: { icon: "{}", colorClass: "text-yellow-400" },
    json: { icon: "{}", colorClass: "text-yellow-400" },
    array: { icon: "[]", colorClass: "text-pink-400" },
  };

  private readonly defaultConfig: TypeConfig = { icon: "?", colorClass: "text-slate-400" };

  readonly config = computed(() => {
    return this._typeMap[this.dataType().toLowerCase()] ?? this.defaultConfig;
  });
}
