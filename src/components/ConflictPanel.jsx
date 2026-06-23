import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, Check, Loader2, Send, Star, X } from "lucide-react";
import { formatClock, formatDuration, findSwapCandidate } from "../lib/risk";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8787";

export default function ConflictPanel({ vehicle, risk, vehicles, bookings, now, onResolve, onClose }) {
  const [options, setOptions] = useState(null);
  const loadingOptions = options === null;
  const [chosenOption, setChosenOption] = useState(null);
  const [messages, setMessages] = useState(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sent, setSent] = useState(false);
  const [usedFallback, setUsedFallback] = useState(false);

  const { activeBooking, nextBooking, lateBy, bufferRemaining } = risk;
  const swapCandidate = findSwapCandidate(bookings, vehicles, vehicle.id, nextBooking);

  function fallbackOptions(candidate) {
    const opts = [];
    if (candidate) {
      opts.push({
        id: "swap",
        label: "Swap the next guest to " + candidate.label,
        description: `Give the incoming guest ${candidate.label} instead, since it's free for the full window they need.`,
        tradeoff: "Guest gets a different vehicle than booked — fine if it's equal or better class.",
        bestWhen: "A same-or-better vehicle is sitting idle, which it is here.",
        recommended: true,
      });
    }
    opts.push({
      id: "nudge-extend",
      label: "Push the late renter, hold the line",
      description: "Send a direct message to the late renter demanding immediate return, and prep the next guest for a possible short delay.",
      tradeoff: "Still depends on the late renter actually responding — no guaranteed fix.",
      bestWhen: "The late renter has a strong track record and is likely just running behind, not ghosting.",
      recommended: !candidate,
    });
    opts.push({
      id: "credit-delay",
      label: "Proactively offer next guest a credit",
      description: "Get ahead of it: tell the next guest now that pickup may run late and offer a credit or free hour as goodwill.",
      tradeoff: "Costs you a small credit even if the late renter shows up in time.",
      bestWhen: "No swap vehicle exists and the late renter's status is unclear.",
      recommended: false,
    });
    return opts;
  }

  useEffect(() => {
    let cancelled = false;

    const payload = {
      vehicle,
      activeBooking,
      nextBooking,
      lateBy: Math.round(lateBy),
      bufferRemaining,
      swapCandidate,
      now,
      formattedNow: formatClock(now),
    };

    fetch(`${API_BASE}/api/resolution-options`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const fetchedOptions = Array.isArray(data.options) && data.options.length ? data.options : fallbackOptions(swapCandidate);
        setOptions(fetchedOptions);
        setUsedFallback(!!data.usedFallback || !Array.isArray(data.options) || data.options.length === 0);
        const rec = fetchedOptions.find((o) => o.recommended) || fetchedOptions[0];
        if (rec) setChosenOption(rec);
      })
      .catch(() => {
        if (cancelled) return;
        setOptions(fallbackOptions(swapCandidate));
        setUsedFallback(true);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function chooseOption(opt) {
    setChosenOption(opt);
    setMessages(null);
    setSent(false);
  }

  function draftMessages() {
    setLoadingMessages(true);
    const payload = {
      vehicle,
      activeBooking,
      nextBooking,
      lateBy: Math.round(lateBy),
      bufferRemaining,
      swapCandidate,
      now,
      formattedNow: formatClock(now),
      chosenOption,
    };
    fetch(`${API_BASE}/api/draft-messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((r) => r.json())
      .then((data) => {
        setMessages(data);
        setUsedFallback((prev) => prev || !!data.usedFallback);
      })
      .finally(() => setLoadingMessages(false));
  }

  function sendAndResolve() {
    setSent(true);
    setTimeout(() => onResolve(activeBooking.id), 650);
  }

  return (
    <div className="conflict-panel">
      <div className="conflict-panel-head">
        <div className="conflict-panel-eyebrow">
          <AlertTriangle size={15} strokeWidth={2.5} />
          Turnaround conflict
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
      </div>

      <h2 className="conflict-title">
        {vehicle.label} won&rsquo;t be back in time for {nextBooking.renterName.split(" ")[0]}
      </h2>
      <p className="conflict-sub">
        {activeBooking.renterName} is <strong>{formatDuration(lateBy)} late</strong> returning &mdash;{" "}
        {bufferRemaining <= 0 ? (
          <>pickup window for the next guest is already blown.</>
        ) : (
          <>only {formatDuration(bufferRemaining)} of buffer left before {nextBooking.renterName.split(" ")[0]}&rsquo;s pickup.</>
        )}
      </p>

      <div className="conflict-grid">
        <div className="conflict-card">
          <div className="conflict-card-label">Out now, overdue</div>
          <div className="conflict-card-name">{activeBooking.renterName}</div>
          <div className="conflict-card-row mono">{activeBooking.renterPhone}</div>
          <div className="conflict-card-row">
            {activeBooking.trips} prior trips
            {activeBooking.rating && (
              <span className="rating">
                <Star size={11} fill="currentColor" /> {activeBooking.rating}
              </span>
            )}
          </div>
          {activeBooking.notes && <div className="conflict-card-note">{activeBooking.notes}</div>}
        </div>

        <ArrowRight className="conflict-grid-arrow" size={18} />

        <div className="conflict-card">
          <div className="conflict-card-label">Waiting on this car</div>
          <div className="conflict-card-name">{nextBooking.renterName}</div>
          <div className="conflict-card-row mono">
            Pickup {formatClock(nextBooking.scheduledStart)}
          </div>
          <div className="conflict-card-row">
            {nextBooking.trips} prior trips
            {nextBooking.rating && (
              <span className="rating">
                <Star size={11} fill="currentColor" /> {nextBooking.rating}
              </span>
            )}
          </div>
          {nextBooking.notes && <div className="conflict-card-note">{nextBooking.notes}</div>}
        </div>
      </div>

      <div className="conflict-section">
        <div className="conflict-section-label">Resolution options</div>

        {loadingOptions && (
          <div className="loading-row">
            <Loader2 size={14} className="spin" /> Working out the best options for this situation…
          </div>
        )}

        {!loadingOptions && options && (
          <div className="option-list">
            {options.map((opt) => (
              <button
                key={opt.id}
                className={`option-card ${chosenOption?.id === opt.id ? "is-chosen" : ""}`}
                onClick={() => chooseOption(opt)}
              >
                <div className="option-card-top">
                  <span className="option-label">{opt.label}</span>
                  {opt.recommended && <span className="option-recommended">Suggested</span>}
                </div>
                <div className="option-desc">{opt.description}</div>
                <div className="option-meta">
                  <span><strong>Tradeoff:</strong> {opt.tradeoff}</span>
                  <span><strong>Best when:</strong> {opt.bestWhen}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {chosenOption && (
        <div className="conflict-section">
          <div className="conflict-section-label">
            Draft messages &mdash; {chosenOption.label}
          </div>

          {!messages && (
            <button className="primary-btn" onClick={draftMessages} disabled={loadingMessages}>
              {loadingMessages ? (
                <>
                  <Loader2 size={15} className="spin" /> Drafting…
                </>
              ) : (
                <>Draft messages for this option</>
              )}
            </button>
          )}

          {messages && (
            <div className="draft-list">
              <div className="draft-card">
                <div className="draft-card-label">To {activeBooking.renterName.split(" ")[0]} (late renter)</div>
                <p className="draft-card-text">{messages.to_late_renter}</p>
              </div>
              <div className="draft-card">
                <div className="draft-card-label">To {nextBooking.renterName.split(" ")[0]} (next guest)</div>
                <p className="draft-card-text">{messages.to_next_guest}</p>
              </div>

              {!sent ? (
                <button className="primary-btn is-confirm" onClick={sendAndResolve}>
                  <Send size={15} /> Send both &amp; close out conflict
                </button>
              ) : (
                <div className="sent-confirm">
                  <Check size={16} /> Sent. Conflict resolved.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {usedFallback && (
        <div className="fallback-note">
          Running on the built-in fallback drafts &mdash; add an <code>ANTHROPIC_API_KEY</code> to <code>.env</code> for live Claude reasoning.
        </div>
      )}
    </div>
  );
}
