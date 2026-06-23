// Turnaround risk engine.
// Given "now" (minutes from sim start) and a vehicle's bookings, work out whether
// the active rental threatens the next one — and how urgently.

export const RISK = {
  CLEAR: "clear", // no active rental, or plenty of buffer
  WATCH: "watch", // return due soon, buffer is getting thin but not gone
  LATE: "late", // past scheduled return, buffer eroding, next guest not yet affected
  CONFLICT: "conflict", // buffer blown — next guest's pickup is now at real risk
  RESOLVED: "resolved", // was a conflict, operator marked it handled
};

// Tunable thresholds, in minutes.
const WATCH_WINDOW_BEFORE_DUE = 20; // start watching 20 min before scheduled return
const CONFLICT_BUFFER_FLOOR = 15; // if remaining buffer to next pickup drops below this, it's a conflict

export function getVehicleBookings(bookings, vehicleId) {
  return bookings
    .filter((b) => b.vehicleId === vehicleId)
    .sort((a, b) => a.scheduledStart - b.scheduledStart);
}

export function getNextBooking(bookings, vehicleId, afterTime) {
  return getVehicleBookings(bookings, vehicleId)
    .filter((b) => b.scheduledStart >= afterTime && b.status !== "cancelled")
    .sort((a, b) => a.scheduledStart - b.scheduledStart)[0];
}

/**
 * Compute the live risk state for a single vehicle at time `now`.
 * Returns null if the vehicle has no active rental (nothing to watch).
 */
export function computeVehicleRisk(bookings, vehicleId, now, overrides = {}) {
  const vehicleBookings = getVehicleBookings(bookings, vehicleId);
  const active = vehicleBookings.find(
    (b) =>
      b.scheduledStart <= now &&
      (b.actualReturnTime === null ? true : b.actualReturnTime > now) &&
      b.status !== "cancelled"
  );

  if (!active) return null;

  // If already returned, nothing to watch for this booking.
  if (active.actualReturnTime !== null && active.actualReturnTime <= now) {
    return null;
  }

  const next = vehicleBookings.find(
    (b) => b.scheduledStart > active.scheduledEnd && b.status !== "cancelled"
  );

  const minutesUntilDue = active.scheduledEnd - now; // negative = already late
  const isLate = minutesUntilDue < 0;
  const lateBy = isLate ? Math.abs(minutesUntilDue) : 0;

  let state;
  let bufferRemaining = null;

  if (next) {
    const projectedReturn = Math.max(now, active.scheduledEnd);
    bufferRemaining = next.scheduledStart - projectedReturn;

    const override = overrides[active.id];
    if (override === "resolved") {
      state = RISK.RESOLVED;
    } else if (bufferRemaining < CONFLICT_BUFFER_FLOOR) {
      state = RISK.CONFLICT;
    } else if (isLate) {
      state = RISK.LATE;
    } else if (minutesUntilDue <= WATCH_WINDOW_BEFORE_DUE) {
      state = RISK.WATCH;
    } else {
      state = RISK.CLEAR;
    }
  } else {
    state = isLate ? RISK.LATE : minutesUntilDue <= WATCH_WINDOW_BEFORE_DUE ? RISK.WATCH : RISK.CLEAR;
  }

  return {
    vehicleId,
    activeBooking: active,
    nextBooking: next || null,
    now,
    minutesUntilDue,
    isLate,
    lateBy,
    bufferRemaining,
    state,
  };
}

export function computeFleetRisk(bookings, vehicles, now, overrides = {}) {
  return vehicles.map((v) => ({
    vehicle: v,
    risk: computeVehicleRisk(bookings, v.id, now, overrides),
  }));
}

// Find a same-or-better class vehicle that's free for the window the next guest needs.
export function findSwapCandidate(bookings, vehicles, forVehicleId, next) {
  if (!next) return null;
  return vehicles
    .filter((v) => v.id !== forVehicleId)
    .find((v) => {
      const vb = getVehicleBookings(bookings, v.id);
      const overlaps = vb.some(
        (b) =>
          b.status !== "cancelled" &&
          b.scheduledStart < next.scheduledEnd &&
          b.scheduledEnd > next.scheduledStart
      );
      return !overlaps;
    });
}

export function formatClock(minutesFromStart, startHour = 8, startMinute = 40) {
  const total = startHour * 60 + startMinute + minutesFromStart;
  let h = Math.floor(total / 60) % 24;
  const m = ((total % 60) + 60) % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  let displayHour = h % 12;
  if (displayHour === 0) displayHour = 12;
  return `${displayHour}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function formatDuration(minutes) {
  const abs = Math.abs(Math.round(minutes));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
