import { Component, input, output, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";

@Component({
  selector: "app-inspector-drawer",
  standalone: true,
  imports: [FormsModule],
  templateUrl: "./inspector-drawer.component.html",
  styleUrl: "./inspector-drawer.component.css",
})
export class InspectorDrawerComponent {
  document = input.required<any>();
  close = output<void>();
  save = output<any>();
  delete = output<void>();

  isEditing = signal(false);
  editText = signal("");

  metadata = () => {
    const doc = this.document();
    if (!doc) return [];
    return Object.entries(doc)
      .slice(0, 8)
      .map(([key, value]) => ({
        key,
        value: typeof value === "object" ? JSON.stringify(value) : String(value),
      }));
  };

  jsonPayload = () => JSON.stringify(this.document(), null, 2);

  onClose() {
    this.isEditing.set(false);
    this.close.emit();
  }

  onSave() {
    try {
      const parsed = JSON.parse(this.editText());
      this.save.emit(parsed);
    } catch {
      this.save.emit(this.document());
    }
    this.isEditing.set(false);
  }

  onDelete() {
    if (confirm("Delete this document permanently? This action cannot be undone.")) {
      this.delete.emit();
    }
  }

  startEdit() {
    this.editText.set(this.jsonPayload());
    this.isEditing.set(true);
  }

  cancelEdit() {
    this.isEditing.set(false);
    this.editText.set("");
  }

  getSyntaxHighlighting(json: string): string {
    return json
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?)/g, (match) => {
        let cls = "json-string";
        if (/:$/.test(match)) {
          cls = "json-key";
          match = match.slice(0, -1);
          return `<span class="${cls}">${match}</span>:`;
        }
        return `<span class="${cls}">${match}</span>`;
      })
      .replace(/\b(true|false)\b/g, '<span class="json-boolean">$1</span>')
      .replace(/\b(null)\b/g, '<span class="json-null">$1</span>')
      .replace(/\b(-?\d+\.?\d*)\b/g, '<span class="json-number">$1</span>');
  }
}
