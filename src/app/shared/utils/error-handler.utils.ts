import { ErrorHandlerService } from "@shared/services/error-handler.service";
import { ToastService } from "@services/services.toast.service";
import { AppError, ErrorCode } from "@entities/entities.error.entity";
interface Result<T> {
  success: boolean;
  data?: T;
  error?: AppError;
}
interface WithErrorHandlingOptions {
  loading?: { set: (value: boolean) => void } | boolean;
  toast?: boolean;
  toastSuccess?: string;
  errorMessage?: string;
  context?: string;
  showToastOnError?: boolean;
}
function isSignalLoading(loading: unknown): loading is { set: (value: boolean) => void } {
  if (loading === null || loading === undefined) return false;
  if (typeof loading === "boolean") return false;
  const loadingObj = loading as { set?: unknown };
  if (typeof loadingObj.set === "function") {
    return true;
  }
  const descriptor = Object.getOwnPropertyDescriptor(loadingObj, "set");
  if (descriptor && typeof descriptor.get === "function") {
    return true;
  }
  return false;
}
function resolveLoadingSetter(
  loading: WithErrorHandlingOptions["loading"]
): ((v: boolean) => void) | null {
  if (!loading) return null;
  if (typeof loading === "boolean") return null;
  if (isSignalLoading(loading)) return loading.set;
  return null;
}
export function withErrorHandling<T>(
  operation: () => Promise<T>,
  options: WithErrorHandlingOptions = {},
  services?: {
    errorHandler?: ErrorHandlerService;
    toastService?: ToastService;
  }
): Promise<Result<T>> {
  const errorHandler = services?.errorHandler;
  const toastService = services?.toastService;
  const setLoading = resolveLoadingSetter(options.loading);
  if (setLoading) {
    setLoading(true);
  }
  return operation()
    .then((data) => {
      if (options.toastSuccess && toastService) {
        toastService.success(options.toastSuccess);
      }
      return { success: true, data } as Result<T>;
    })
    .catch((err) => {
      if (errorHandler) {
        errorHandler.handleError(err, options.context);
      }
      if (options.showToastOnError !== false && toastService) {
        if (options.errorMessage) {
          toastService.error(options.errorMessage);
        } else if (err instanceof Error) {
          toastService.error(err.message);
        }
      }
      const appError = errorHandler
        ? {
            code: "UNKNOWN" as ErrorCode,
            message: String(err),
            userMessage: options.errorMessage || "An error occurred",
            timestamp: new Date(),
            retryable: true,
          }
        : {
            code: "UNKNOWN" as ErrorCode,
            message: String(err),
            userMessage: options.errorMessage || "An error occurred",
            timestamp: new Date(),
            retryable: true,
          };
      return { success: false, error: appError } as Result<T>;
    })
    .finally(() => {
      if (setLoading) {
        setLoading(false);
      }
    });
}
