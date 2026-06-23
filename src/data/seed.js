// All times are minutes-from-simulation-start, so the demo clock can run fast.
// "Now" starts at T=0 (8:40 AM on the operator's day) and the sim plays forward.

export const SIM_START_LABEL = "8:40 AM";

export const VEHICLES = [
  { id: "v1", label: "Civic 04", plate: "7KXM201", className: "Compact" },
  { id: "v2", label: "CR-V 11", plate: "8DRT552", className: "SUV" },
  { id: "v3", label: "Model 3 02", plate: "9PLE830", className: "Electric" },
  { id: "v4", label: "Tacoma 07", plate: "6NWB417", className: "Truck" },
  { id: "v5", label: "Sonata 09", plate: "5JFQ662", className: "Midsize" },
];

// minutes is relative to SIM start (0). 60 = 1 hour later, -120 = 2 hours before sim start.
export const BOOKINGS = [
  // v1: Civic — THE SCRIPTED CONFLICT.
  // Active rental due back at +40, next guest picks up at +70 — only a 30 min buffer.
  // Renter is going to run late and not respond right away.
  {
    id: "b101",
    vehicleId: "v1",
    renterName: "Marcus Webb",
    renterPhone: "+1 (415) 555-0142",
    trips: 2,
    rating: 4.6,
    scheduledStart: -1400,
    scheduledEnd: 40,
    status: "active",
    actualReturnTime: null,
    notes: "First rental with this fleet was clean. No flags.",
  },
  {
    id: "b102",
    vehicleId: "v1",
    renterName: "Priya Anand",
    renterPhone: "+1 (628) 555-0199",
    trips: 14,
    rating: 4.95,
    scheduledStart: 70,
    scheduledEnd: 1500,
    status: "upcoming",
    actualReturnTime: null,
    notes: "Repeat guest, books monthly for client visits. Always on time.",
  },

  // v2: CR-V — healthy gap, nothing to do. Background texture.
  {
    id: "b201",
    vehicleId: "v2",
    renterName: "Dana Okafor",
    renterPhone: "+1 (510) 555-0118",
    trips: 6,
    rating: 4.8,
    scheduledStart: -800,
    scheduledEnd: 90,
    status: "active",
    actualReturnTime: null,
    notes: "",
  },
  {
    id: "b202",
    vehicleId: "v2",
    renterName: "Leo Park",
    renterPhone: "+1 (650) 555-0177",
    trips: 3,
    rating: 4.7,
    scheduledStart: 300,
    scheduledEnd: 1800,
    status: "upcoming",
    actualReturnTime: null,
    notes: "",
  },

  // v3: Model 3 — idle and available the whole window. This becomes the swap candidate.
  {
    id: "b301",
    vehicleId: "v3",
    renterName: "—",
    renterPhone: "",
    trips: 0,
    rating: null,
    scheduledStart: 1800,
    scheduledEnd: 3200,
    status: "upcoming",
    actualReturnTime: null,
    notes: "Next booking not until later today — open for same-day swap.",
  },

  // v4: Tacoma — active, returns comfortably before next booking. Background texture.
  {
    id: "b401",
    vehicleId: "v4",
    renterName: "Holt Reyes",
    renterPhone: "+1 (925) 555-0163",
    trips: 9,
    rating: 4.9,
    scheduledStart: -300,
    scheduledEnd: 120,
    status: "active",
    actualReturnTime: null,
    notes: "",
  },
  {
    id: "b402",
    vehicleId: "v4",
    renterName: "Sasha Lin",
    renterPhone: "+1 (707) 555-0184",
    trips: 1,
    rating: 4.5,
    scheduledStart: 240,
    scheduledEnd: 1900,
    status: "upcoming",
    actualReturnTime: null,
    notes: "",
  },

  // v5: Sonata — tight-ish gap but renter has a flawless record, used as a contrast case
  // (amber earlier, but resolves itself — shows the system doesn't cry wolf).
  {
    id: "b501",
    vehicleId: "v5",
    renterName: "Grace Tanaka",
    renterPhone: "+1 (831) 555-0129",
    trips: 21,
    rating: 5.0,
    scheduledStart: -600,
    scheduledEnd: 25,
    status: "active",
    actualReturnTime: 18, // returns early — resolves on its own as sim plays
    notes: "Power host favorite. Always early.",
  },
  {
    id: "b502",
    vehicleId: "v5",
    renterName: "Imani Carter",
    renterPhone: "+1 (209) 555-0155",
    trips: 5,
    rating: 4.85,
    scheduledStart: 55,
    scheduledEnd: 1600,
    status: "upcoming",
    actualReturnTime: null,
    notes: "",
  },
];
