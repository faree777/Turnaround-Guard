import { useEffect, useRef, useState, useCallback } from "react";

// One real second = SPEED sim-minutes, by default. Adjustable.
export function useSimClock({ initial = 0, max = 90, defaultSpeed = 2 } = {}) {
  const [now, setNow] = useState(initial);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(defaultSpeed);
  const rafRef = useRef(null);
  const lastTsRef = useRef(null);

  useEffect(() => {
    if (!playing) return;
    lastTsRef.current = null;

    const tick = (ts) => {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const deltaSec = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;
      setNow((prev) => {
        const next = prev + deltaSec * speed;
        if (next >= max) {
          setPlaying(false);
          return max;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, speed, max]);

  const play = useCallback(() => setPlaying(true), []);
  const pause = useCallback(() => setPlaying(false), []);
  const reset = useCallback(() => {
    setPlaying(false);
    setNow(initial);
  }, [initial]);
  const scrubTo = useCallback((val) => {
    setPlaying(false);
    setNow(Math.max(0, Math.min(max, val)));
  }, [max]);

  return { now, playing, speed, setSpeed, play, pause, reset, scrubTo, max };
}
