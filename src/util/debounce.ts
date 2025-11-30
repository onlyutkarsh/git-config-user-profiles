/**
 * Debounce utility to prevent excessive function calls
 * @param func The function to debounce
 * @param delay Delay in milliseconds (default: 300ms)
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(func: T, delay: number = 300): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | undefined;

  return function (this: any, ...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}

/**
 * Throttle utility to ensure function is called at most once per delay period
 * @param func The function to throttle
 * @param delay Delay in milliseconds (default: 300ms)
 * @returns Throttled function
 */
export function throttle<T extends (...args: any[]) => any>(func: T, delay: number = 300): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeoutId: NodeJS.Timeout | undefined;

  return function (this: any, ...args: Parameters<T>) {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;

    if (timeSinceLastCall >= delay) {
      lastCall = now;
      func.apply(this, args);
    } else {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        func.apply(this, args);
      }, delay - timeSinceLastCall);
    }
  };
}
