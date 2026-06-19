/// <reference lib="webworker" />

interface ProcessedItem {
  index: number;
  highlightedLines: Array<{ num: number; html: string }>;
  json: string;
}

addEventListener("message", ({ data }) => {
  if (data.type === "process") {
    const documents = data.documents as Array<{ index: number; json: string }>;
    const processed: ProcessedItem[] = documents.map((doc) => {
      const lines = doc.json.split("\n");
      const highlightedLines = lines.map((line, i) => ({
        num: i + 1,
        html: line,
      }));
      return {
        index: doc.index,
        highlightedLines,
        json: doc.json,
      };
    });
    postMessage({ type: "result", processed });
  }
});
