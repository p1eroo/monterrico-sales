import { useEffect, useState } from 'react';

const STORAGE_KEY = 'flota-por-autorizar';

export function usePorAutorizarCount(): number {
  const [count, setCount] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw).length : 0;
    } catch {
      return 0;
    }
  });

  useEffect(() => {
    const refresh = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        setCount(raw ? JSON.parse(raw).length : 0);
      } catch {
        setCount(0);
      }
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refresh();
    });
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  return count;
}
