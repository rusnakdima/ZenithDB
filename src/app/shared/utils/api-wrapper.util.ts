import { LoadingService } from "@shared/services/loading.service";

export async function withLoading<T>(
  loading: LoadingService,
  message: string,
  operation: () => Promise<T>
): Promise<T> {
  loading.show(message);
  try {
    return await operation();
  } finally {
    loading.hide();
  }
}

export async function withConnectionAndLoading<T>(
  connectionId: string | null,
  loading: LoadingService,
  message: string,
  operation: (connId: string) => Promise<T>
): Promise<T> {
  if (!connectionId) throw new Error("No active connection");
  loading.show(message);
  try {
    return await operation(connectionId);
  } finally {
    loading.hide();
  }
}
