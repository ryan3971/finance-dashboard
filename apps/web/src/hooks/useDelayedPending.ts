import { useEffect, useState } from 'react';

const DEFAULT_DELAY = 200;

export function useDelayedPending(isPending: boolean, delay = DEFAULT_DELAY) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isPending) {
      setShow(false);
      return;
    }
    const id = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(id);
  }, [isPending, delay]);

  return show;
}
