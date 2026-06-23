import { useMemo, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { VEHICLES, BOOKINGS, SIM_START_LABEL } from "./data/seed";
import { computeVehicleRisk, RISK } from "./lib/risk";
import { useSimClock } from "./lib/useSimClock";
import RunwayView from "./components/RunwayView";
import ConflictPanel from "./components/ConflictPanel";
import ClockBar from "./components/ClockBar";
import "./App.css";

export default function App() {
  const clock = useSimClock({ initial: 0, max: 90, defaultSpeed: 2 });
  const [overrides, setOverrides] = useState({});
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);

  const conflictCount = useMemo(() => {
    return VEHICLES.filter((v) => {
      const r = computeVehicleRisk(BOOKINGS, v.id, clock.now, overrides);
      return r && r.state === RISK.CONFLICT;
    }).length;
  }, [clock.now, overrides]);

  const selectedVehicle = VEHICLES.find((v) => v.id === selectedVehicleId);
  const selectedRisk = selectedVehicle
    ? computeVehicleRisk(BOOKINGS, selectedVehicle.id, clock.now, overrides)
    : null;

  function handleResolve(bookingId) {
    setOverrides((prev) => ({ ...prev, [bookingId]: "resolved" }));
    setSelectedVehicleId(null);
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <ShieldAlert size={20} strokeWidth={2.2} />
          <span>Turnaround Guard</span>
        </div>
        <div className="header-status">
          <span className={`status-pill ${conflictCount > 0 ? "is-alert" : "is-clear"}`}>
            {conflictCount > 0 ? `${conflictCount} active conflict${conflictCount > 1 ? "s" : ""}` : "All clear"}
          </span>
          <span className="header-day mono">Today &middot; sim starts {SIM_START_LABEL}</span>
        </div>
      </header>

      <ClockBar clock={clock} />

      <main className="app-main">
        <RunwayView
          vehicles={VEHICLES}
          bookings={BOOKINGS}
          now={clock.now}
          overrides={overrides}
          selectedVehicleId={selectedVehicleId}
          onSelectConflict={(vid) => {
            clock.pause();
            setSelectedVehicleId(vid);
          }}
        />

        {selectedVehicle && selectedRisk && selectedRisk.nextBooking && (
          <aside className="panel-dock">
            <ConflictPanel
              key={`${selectedVehicle.id}:${selectedRisk.activeBooking.id}`}
              vehicle={selectedVehicle}
              risk={selectedRisk}
              vehicles={VEHICLES}
              bookings={BOOKINGS}
              now={clock.now}
              onResolve={handleResolve}
              onClose={() => setSelectedVehicleId(null)}
            />
          </aside>
        )}
      </main>

      <footer className="app-footer">
        Demo fleet &middot; bookings are scripted for this walkthrough &middot; nothing here touches a real renter
      </footer>
    </div>
  );
}
