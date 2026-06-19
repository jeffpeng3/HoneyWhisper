import { SettingsStore } from "./SettingsStore";

type StoreProxy<T> = SettingsStore<T> & T;

export function useStoreValue<T, K extends keyof T>(store: StoreProxy<T>, key: K): T[K] {
  let value = $state(store[key as string]);
  $effect(() => {
    const unsub = (store as SettingsStore<T>).onChange(() => {
      value = (store as any)[key as string];
    });
    return unsub;
  });
  return value;
}
