function readRawValue(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    // Private browsing or a disabled storage policy must not block the app.
    console.warn(`Could not read "${key}" from localStorage.`, error);
    return null;
  }
}

export function hasStoredValue(key: string) {
  return readRawValue(key) !== null;
}

export function getStoredValue<T>(key: string, fallback: T): T {
  const savedValue = readRawValue(key);

  if (!savedValue) return fallback;

  try {
    return JSON.parse(savedValue) as T;
  } catch {
    try {
      localStorage.removeItem(key);
    } catch {
      // The malformed value is ignored when storage cannot be modified.
    }
    return fallback;
  }
}

export function saveStoredValue<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // Quota exceeded or storage disabled: keep the in-memory state working.
    console.warn(`Could not persist "${key}" to localStorage.`, error);
  }
}

export function readSampleData<T>(key: string, fallback: T): T {
  const savedValue = readRawValue(key);

  if (!savedValue) {
    saveStoredValue(key, fallback);
    return fallback;
  }

  try {
    return JSON.parse(savedValue) as T;
  } catch {
    saveStoredValue(key, fallback);
    return fallback;
  }
}
