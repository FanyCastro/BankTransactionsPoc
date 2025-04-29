// src/utils/debounce.ts
export function debounce<T extends (...args: any[]) => void>(func: T, wait: number) {
  let timeout: NodeJS.Timeout | null = null;

  const debounced = (...args: Parameters<T>) => {
      if (timeout) {
          clearTimeout(timeout);
      }
      timeout = setTimeout(() => {
          func(...args);
      }, wait);
  };

  debounced.cancel = () => {
      if (timeout) {
          clearTimeout(timeout);
          timeout = null;
      }
  };

  return debounced as T & { cancel: () => void };
}
