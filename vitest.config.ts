import { defineConfig } from "vitest/config";
import angular from "@angular/build";
import path from "path";

export default defineConfig({
  plugins: [
    angular({
      tsconfig: "./tsconfig.json",
    }),
  ],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["src/test-setup.ts"],
    include: ["src/**/*.{spec,test}.ts"],
    reporters: ["default", "html"],
    outputFile: {
      html: "coverage/html-report.html",
    },
  },
  resolve: {
    alias: {
      "@app": path.resolve(__dirname, "./src/app"),
      "@shared": path.resolve(__dirname, "./src/app/shared"),
      "@services": path.resolve(__dirname, "./src/app/services"),
      "@providers": path.resolve(__dirname, "./src/app/providers"),
    },
  },
});
