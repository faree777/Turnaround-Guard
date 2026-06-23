import { RISK, computeVehicleRisk, formatClock, getVehicleBookings } from "../lib/risk";
import { AlertTriangle, Clock3 } from "lucide-react";

const TIMELINE_START = -120; // show 2hr before sim start
const TIMELINE_END = 200; // through 3h20m after sim start

const RISK_COLOR = {
  [RISK.CLEAR]: "var(--slate)",
  [RISK.WATCH]: "var(--signal-amber)",
  [RISK.LATE]: "var(--signal-amber)",
  [RISK.CONFLICT]: "var(--signal-red)",
  [RISK.RESOLVED]: "var(--signal-green)",
};

function pct(value) {
  return ((value - TIMELINE_START) / (TIMELINE_END - TIMELINE_START)) * 100;
}

export default function RunwayView({ vehicles, bookings, now, overrides, onSelectConflict, selectedVehicleId }) {
  return (
    <div className="runway">
      <div className="runway-header">
        <div className="runway-header-label">Fleet</div>
        <div className="runway-header-track">
          <div className="runway-now-label mono" style={{ left: `${pct(now)}%` }}>
            {formatClock(now)}
          </div>
        </div>
      </div>

      {vehicles.map((vehicle) => {
        const vb = getVehicleBookings(bookings, vehicle.id);
        const risk = computeVehicleRisk(bookings, vehicle.id, now, overrides);
        const isFlagged = risk && (risk.state === RISK.CONFLICT || risk.state === RISK.LATE || risk.state === RISK.WATCH);
        const isSelected = selectedVehicleId === vehicle.id;

        return (
          <div
            key={vehicle.id}
            className={`runway-lane ${isFlagged ? "is-flagged" : ""} ${isSelected ? "is-selected" : ""}`}
          >
            <div className="runway-lane-label">
              <div className="runway-lane-name">{vehicle.label}</div>
              <div className="runway-lane-meta mono">{vehicle.plate}</div>
              {risk && risk.state === RISK.CONFLICT && (
                <button className="runway-flag-btn" onClick={() => onSelectConflict(vehicle.id)}>
                  <AlertTriangle size={13} strokeWidth={2.5} />
                  Conflict
                </button>
              )}
              {risk && risk.state === RISK.LATE && (
                <button className="runway-flag-btn is-amber" onClick={() => onSelectConflict(vehicle.id)}>
                  <Clock3 size={13} strokeWidth={2.5} />
                  Running late
                </button>
              )}
              {risk && risk.state === RISK.WATCH && (
                <button className="runway-flag-btn is-amber-soft" onClick={() => onSelectConflict(vehicle.id)}>
                  <Clock3 size={13} strokeWidth={2.5} />
                  Watch
                </button>
              )}
              {risk && risk.state === RISK.RESOLVED && (
                <span className="runway-flag-btn is-green">Resolved</span>
              )}
            </div>

            <div className="runway-lane-track">
              {vb.map((b) => {
                const left = pct(Math.max(b.scheduledStart, TIMELINE_START));
                const right = pct(Math.min(b.scheduledEnd, TIMELINE_END));
                const width = Math.max(right - left, 1.5);
                const isActiveBooking = risk?.activeBooking?.id === b.id;
                const blockColor = isActiveBooking ? RISK_COLOR[risk.state] : "var(--slate-dim)";
                const isLateOverhang = isActiveBooking && risk.isLate;

                return (
                  <div
                    key={b.id}
                    className={`runway-block ${isActiveBooking ? "is-active" : ""} ${isLateOverhang ? "is-overhang" : ""}`}
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      borderColor: blockColor,
                      background: isActiveBooking ? `color-mix(in srgb, ${blockColor} 18%, transparent)` : "transparent",
                    }}
                    title={`${b.renterName} · ${formatClock(b.scheduledStart)}–${formatClock(b.scheduledEnd)}`}
                  >
                    <span className="runway-block-name">{b.renterName}</span>
                  </div>
                );
              })}

              <div className="runway-now-line" style={{ left: `${pct(now)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
