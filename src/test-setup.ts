import "@testing-library/jest-dom";
import { vi } from "vitest";
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));
vi.mock("@tauri-apps/api/plugin-dialog", () => ({
  open: vi.fn(),
  save: vi.fn(),
}));
vi.mock("@tauri-apps/api/plugin-fs", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));
