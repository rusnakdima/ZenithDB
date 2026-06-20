/// <reference lib="webworker" />
import { highlightJsonLine } from "@shared/utils/json.utils";
import { RowData } from "@entities/entities.connection.config";
export interface WorkerMessage {
  type: "process";
  documents: RowData[];
  startIndex: number;
}
export interface WorkerResponse {
  type: "result";
  processed: Array<{
    index: number;
    json: string;
    highlightedLines: Array<{ num: number; html: string }>;
  }>;
  progress: number;
}
addEventListener("message", ({ data }: MessageEvent<WorkerMessage>) => {
  if (data.type === "process") {
    const { documents, startIndex } = data;
    const processed = documents.map((doc, idx) => {
      const jsonStr = JSON.stringify(doc, null, 2);
      const rawLines = jsonStr.split("\n");
      const highlightedLines = rawLines.map((line, lineIdx) => ({
        num: lineIdx + 1,
        html: highlightJsonLine(line),
      }));
      return {
        index: startIndex + idx,
        json: jsonStr,
        highlightedLines,
      };
    });
    const response: WorkerResponse = {
      type: "result",
      processed,
      progress: 100,
    };
    postMessage(response);
  }
});
