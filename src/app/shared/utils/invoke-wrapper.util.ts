import { ErrorHandlerService } from "@shared/services/error-handler.service";

export async function invokeWithAbortHandling<T>(
  invokeFn: () => Promise<T>,
  context: string,
  errorHandler: ErrorHandlerService
): Promise<T> {
  try {
    return await invokeFn();
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("Operation cancelled");
    }
    errorHandler.handleError(e, context);
    throw e;
  }
}

export async function invokeWithAbortHandlingOrDefault<T>(
  invokeFn: () => Promise<T>,
  context: string,
  errorHandler: ErrorHandlerService,
  defaultValue: T
): Promise<T> {
  try {
    return await invokeFn();
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return defaultValue;
    }
    errorHandler.handleError(e, context);
    throw e;
  }
}
