import { Injectable, inject } from "@angular/core";
import { invoke } from "@tauri-apps/api/core";
import { UISchema } from "./schema.types";

export interface TauriCommandOptions {
  timeout?: number;
  retryCount?: number;
}

@Injectable({ providedIn: "root" })
export class TauriCommandsService {
  async invoke<T>(
    command: string,
    args?: Record<string, unknown>,
    options?: TauriCommandOptions
  ): Promise<T> {
    const { timeout = 30000, retryCount = 0 } = options || {};

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        const result = await invoke<T>(command, args);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < retryCount) {
          await this.delay(Math.pow(2, attempt) * 100);
        }
      }
    }

    throw lastError || new Error(`Command ${command} failed after ${retryCount + 1} attempts`);
  }

  async getSchema(id: string): Promise<UISchema | null> {
    return this.invoke<UISchema | null>("get_ui_schema", { id });
  }

  async saveSchema(schema: UISchema): Promise<UISchema> {
    return this.invoke<UISchema>("save_ui_schema", { schema });
  }

  async listSchemas(): Promise<UISchema[]> {
    return this.invoke<UISchema[]>("list_ui_schemas");
  }

  async deleteSchema(id: string): Promise<void> {
    return this.invoke<void>("delete_ui_schema", { id });
  }

  async getSchemaByCollection(collectionName: string): Promise<UISchema | null> {
    return this.invoke<UISchema | null>("get_schema_by_collection", { collectionName });
  }

  async saveSchemaForCollection(collectionName: string, schema: UISchema): Promise<UISchema> {
    return this.invoke<UISchema>("save_schema_for_collection", { schema, collectionName });
  }

  async exportSchema(id: string, format: "json" | "yaml"): Promise<string> {
    return this.invoke<string>("export_schema", { id, format });
  }

  async importSchema(content: string, format: "json" | "yaml"): Promise<UISchema> {
    return this.invoke<UISchema>("import_schema", { content, format });
  }

  async validateSchema(schema: UISchema): Promise<{ valid: boolean; errors: string[] }> {
    return this.invoke<{ valid: boolean; errors: string[] }>("validate_schema", { schema });
  }

  async getDefaultSchema(): Promise<UISchema | null> {
    return this.invoke<UISchema | null>("get_default_schema");
  }

  async setDefaultSchema(id: string): Promise<void> {
    return this.invoke<void>("set_default_schema", { id });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
