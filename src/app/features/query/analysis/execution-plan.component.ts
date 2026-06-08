import { Component, Input, signal, computed } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ExecutionPlanNode } from "./query-analyzer.service";

@Component({
  selector: "app-execution-plan",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./execution-plan.component.html",
})
export class ExecutionPlanComponent {
  @Input() set planNodes(value: ExecutionPlanNode[]) {
    this.nodes.set(value);
    this.initializeExpanded();
  }

  @Input() set analysisScore(value: number) {
    this.score.set(value);
  }

  nodes = signal<ExecutionPlanNode[]>([]);
  score = signal(100);
  expandedNodes = signal<Set<string>>(new Set());

  totalCost = computed(() => {
    return this.nodes().reduce((sum, node) => sum + node.cost, 0);
  });

  scoreColor = computed(() => {
    const s = this.score();
    if (s >= 80) return "text-emerald-400";
    if (s >= 50) return "text-amber-400";
    return "text-red-400";
  });

  scoreBgColor = computed(() => {
    return "border border-[var(--accent)]/30";
  });

  private initializeExpanded(): void {
    const allIds = new Set<string>();
    this.collectNodeIds(this.nodes(), allIds);
    this.expandedNodes.set(allIds);
  }

  private collectNodeIds(nodes: ExecutionPlanNode[], ids: Set<string>): void {
    for (const node of nodes) {
      ids.add(node.id);
      this.collectNodeIds(node.children, ids);
    }
  }

  toggleNode(nodeId: string): void {
    this.expandedNodes.update((set) => {
      const newSet = new Set(set);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  }

  isExpanded(nodeId: string): boolean {
    return this.expandedNodes().has(nodeId);
  }

  hasChildren(node: ExecutionPlanNode): boolean {
    return node.children.length > 0;
  }

  getOperationColor(operation: string): string {
    switch (operation) {
      case "COLLECTION_SCAN":
        return "text-red-400 bg-red-500/10";
      case "INDEX_SCAN":
        return "text-emerald-400 bg-emerald-500/10";
      case "FILTER":
        return "text-blue-400 bg-blue-500/10";
      case "AND":
      case "OR":
        return "text-purple-400 bg-purple-500/10";
      default:
        return "text-slate-400 bg-slate-500/10";
    }
  }

  getCostColor(cost: number): string {
    if (cost >= 80) return "text-red-400";
    if (cost >= 30) return "text-amber-400";
    return "text-emerald-400";
  }

  trackByNodeId(index: number, node: ExecutionPlanNode): string {
    return node.id;
  }
}
