export function getStoredValue<T>(key: string, fallback: T): T {
  const savedValue = localStorage.getItem(key);

  if (!savedValue) return fallback;

  try {
    return JSON.parse(savedValue) as T;
  } catch {
    localStorage.removeItem(key);
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
  const savedValue = localStorage.getItem(key);

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
