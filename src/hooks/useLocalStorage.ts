import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { getStoredValue, saveStoredValue } from "../services/browserStorage";

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    const legacyPrefix = ["campo", "aberto"].join("-");
    const legacyKey = key.replace(/^playup\./, `${legacyPrefix}.`);
    const currentValue = localStorage.getItem(key);
    const legacyValue = localStorage.getItem(legacyKey);

    if (currentValue) return getStoredValue(key, initialValue);

    if (legacyValue) {
      const migratedValue = getStoredValue(legacyKey, initialValue);
      saveStoredValue(key, migratedValue);
      return migratedValue;
    }

    return initialValue;
  });

  useEffect(() => {
    saveStoredValue(key, value);
  }, [key, value]);

  return [value, setValue];
}
