import { WritableSignal } from "@angular/core";

export function updateSignalMap<K, V>(signal: WritableSignal<Map<K, V>>, key: K, value: V): void {
  signal.update((map: Map<K, V>) => {
    const newMap = new Map(map);
    newMap.set(key, value);
    return newMap;
  });
}

export function addToArraySignal<T>(signal: WritableSignal<T[]>, item: T): void {
  signal.update((arr: T[]) => [...arr, item]);
}

export function removeFromArraySignal<T>(
  signal: WritableSignal<T[]>,
  predicate: (item: T) => boolean
): void {
  signal.update((arr: T[]) => arr.filter(predicate));
}
