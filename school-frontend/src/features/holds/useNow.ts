import { useEffect, useState } from 'react';

/**
 * The device's current time, for components that show a countdown.
 *
 * While `ticking` is true the component re-renders every second, so the remaining time
 * and the status derived from it update on their own: no page reload, no server call.
 * If `wakeAtMs` is given, it also re-renders at exactly that moment, so a status that
 * changes then (a hold expiring) flips on time instead of up to a second late.
 *
 * The value returned is read from the clock at render time, not remembered from the last
 * tick. A render can also be caused by data arriving between two ticks, and computing
 * "time left" against a clock value up to a second old would overstate it, and would
 * briefly show a hold that has just expired as still HELD.
 */
export function useNow(ticking: boolean, wakeAtMs?: number): number {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!ticking) {
      return;
    }
    const timer = window.setInterval(() => setTick((tick) => tick + 1), 1000);
    return () => window.clearInterval(timer);
  }, [ticking]);

  useEffect(() => {
    if (!ticking || wakeAtMs === undefined) {
      return;
    }
    const delay = wakeAtMs - Date.now();
    if (delay <= 0) {
      return;
    }
    const timer = window.setTimeout(() => setTick((tick) => tick + 1), delay);
    return () => window.clearTimeout(timer);
  }, [ticking, wakeAtMs]);

  return Date.now();
}
