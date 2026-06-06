export interface DebounceHandle {
  execute: (...args: unknown[]) => void;
  cancel: () => void;
}

export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delayMs: number
): DebounceHandle {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const execute = ((...args: unknown[]) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delayMs);
  }) as DebounceHandle["execute"];

  const cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return { execute, cancel };
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
