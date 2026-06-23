import { Pause, Play, RotateCcw } from "lucide-react";
import { formatClock } from "../lib/risk";

export default function ClockBar({ clock }) {
  const { now, playing, speed, setSpeed, play, pause, reset, scrubTo, max } = clock;

  return (
    <div className="clock-bar">
      <button className="clock-play-btn" onClick={playing ? pause : play} aria-label={playing ? "Pause" : "Play"}>
        {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
      </button>

      <button className="icon-btn" onClick={reset} aria-label="Reset to start">
        <RotateCcw size={15} />
      </button>

      <div className="clock-time mono">{formatClock(now)}</div>

      <input
        className="clock-scrub"
        type="range"
        min={0}
        max={max}
        step={0.5}
        value={now}
        onChange={(e) => scrubTo(Number(e.target.value))}
      />

      <div className="clock-speed">
        {[1, 2, 4, 8].map((s) => (
          <button
            key={s}
            className={`speed-btn ${speed === s ? "is-active" : ""}`}
            onClick={() => setSpeed(s)}
          >
            {s}×
          </button>
        ))}
      </div>
    </div>
  );
}
