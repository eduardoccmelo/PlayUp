import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import {
  getStoredValue,
  hasStoredValue,
  saveStoredValue,
} from "../services/browserStorage";

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    const legacyPrefix = ["campo", "aberto"].join("-");
    const legacyKey = key.replace(/^playup\./, `${legacyPrefix}.`);
    if (hasStoredValue(key)) return getStoredValue(key, initialValue);

    if (hasStoredValue(legacyKey)) {
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
