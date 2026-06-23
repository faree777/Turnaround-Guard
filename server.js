import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Groq from "groq-sdk";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const apiKey = process.env.GROQ_API_KEY;
const client = apiKey ? new Groq({ apiKey }) : null;

const MODEL = "llama-3.3-70b-versatile";

// ---- Helpers -------------------------------------------------------------

function buildContext({ vehicle, activeBooking, nextBooking, lateBy, bufferRemaining, swapCandidate, now, formattedNow }) {
  return `
FLEET CONTEXT
Operator runs a small direct-booking car rental fleet (no marketplace, no spare inventory beyond their own cars).
Current time: ${formattedNow}

VEHICLE AT RISK
${vehicle.label} (${vehicle.className}, plate ${vehicle.plate})

LATE RENTAL (currently out)
Renter: ${activeBooking.renterName}, ${activeBooking.trips} prior trips, rating ${activeBooking.rating ?? "n/a"}
Scheduled return: already due
Currently late by: ${lateBy} minutes
Operator notes on this renter: ${activeBooking.notes || "none"}

NEXT BOOKING ON THIS CAR (at risk)
Guest: ${nextBooking.renterName}, ${nextBooking.trips} prior trips, rating ${nextBooking.rating ?? "n/a"}
Scheduled pickup: in ${Math.max(0, Math.round(nextBooking.scheduledStart - now))} minutes from now
Buffer remaining before pickup: ${Math.round(bufferRemaining)} minutes (negative or near-zero means the pickup window is effectively blown)
Operator notes on this guest: ${nextBooking.notes || "none"}

AVAILABLE SWAP VEHICLE
${swapCandidate ? `${swapCandidate.label} (${swapCandidate.className}) — confirmed free for the full window the next guest needs.` : "None available — every other vehicle is booked or out during this window."}
`.trim();
}

// ---- Route: generate ranked resolution options ----------------------------

app.post("/api/resolution-options", async (req, res) => {
  try {
    const ctx = buildContext(req.body);

    if (!client) {
      return res.json({ usedFallback: true, options: fallbackOptions(req.body) });
    }

    const systemPrompt = `You are an operations advisor embedded in a car rental fleet console, helping a solo or small-team operator resolve a turnaround conflict: a rental is running late and it threatens the next guest's pickup.

Produce 3 ranked resolution options. For each option give: a short label (3-5 words), what it actually does, the tradeoff/risk, and who it's best for. Be concrete and realistic — this is for an operator with no spare inventory beyond their own fleet, who needs to decide in the next two minutes, not deliberate for an hour.

Respond ONLY with valid JSON, no markdown fences, no preamble. Schema:
{
  "options": [
    { "id": "string-slug", "label": "string", "description": "string", "tradeoff": "string", "bestWhen": "string", "recommended": boolean }
  ]
}
Exactly one option should have recommended: true — the one you'd actually pick given the specific context (renter history, buffer size, swap availability). Order by how good the option is, best first.`;

    const msg = await client.chat.completions.create({
      model: MODEL,
      max_tokens: 1000,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: ctx },
      ],
    });

    const text = msg.choices[0]?.message?.content ?? "{}";
    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    res.json({ usedFallback: false, options: parsed.options });
  } catch (err) {
    console.error("resolution-options error:", err.message);
    res.json({ usedFallback: true, options: fallbackOptions(req.body), error: err.message });
  }
});

// ---- Route: draft the actual messages for a chosen option ----------------

app.post("/api/draft-messages", async (req, res) => {
  try {
    const { chosenOption, ...contextBody } = req.body;
    const ctx = buildContext(contextBody);

    if (!client) {
      return res.json({ usedFallback: true, ...fallbackMessages(contextBody, chosenOption) });
    }

    const systemPrompt = `You are drafting real, send-ready messages for a car rental operator resolving a turnaround conflict. The operator has chosen this resolution path: "${chosenOption.label} — ${chosenOption.description}"

Write two short messages:
1. to_late_renter: firm but human, no scolding, states the situation and what's needed from them right now.
2. to_next_guest: protects the relationship, transparent about the delay without oversharing blame, states exactly what happens next for them (their pickup, any adjustment, any compensation if relevant to the chosen option).

Keep both messages under 80 words, plain conversational text (no markdown, no headers), ready to paste into SMS or email as-is. Use the actual names and times given in context. If the chosen option includes a credit, discount, or swap, state it as a concrete commitment, not a vague apology.

Respond ONLY with valid JSON, no markdown fences:
{ "to_late_renter": "string", "to_next_guest": "string" }`;

    const msg = await client.chat.completions.create({
      model: MODEL,
      max_tokens: 600,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: ctx },
      ],
    });

    const text = msg.choices[0]?.message?.content ?? "{}";
    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    res.json({ usedFallback: false, ...parsed });
  } catch (err) {
    console.error("draft-messages error:", err.message);
    res.json({ usedFallback: true, ...fallbackMessages(req.body, req.body.chosenOption), error: err.message });
  }
});

// ---- Deterministic fallback (no API key present) --------------------------

function fallbackOptions({ swapCandidate }) {
  const opts = [];
  if (swapCandidate) {
    opts.push({
      id: "swap",
      label: "Swap the next guest to " + swapCandidate.label,
      description: `Give the incoming guest ${swapCandidate.label} instead, since it's free for the full window they need.`,
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
    recommended: !swapCandidate,
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

function fallbackMessages({ activeBooking, nextBooking, vehicle, lateBy }, chosenOption) {
  return {
    to_late_renter: `Hi ${activeBooking.renterName.split(" ")[0]}, this is your host — ${vehicle.label} was due back ${lateBy} min ago and we have another guest waiting on it. Can you confirm your ETA right now? Need the car back as soon as possible.`,
    to_next_guest: `Hi ${nextBooking.renterName.split(" ")[0]}, quick heads up — the previous renter is running a few minutes behind on ${vehicle.label}. ${chosenOption?.description || "We're handling it and will update you with your pickup time shortly."} Thanks for your patience.`,
  };
}

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log(`Resolution engine listening on :${PORT}${client ? " (Groq live)" : " (no GROQ_API_KEY — using deterministic fallback)"}`);
});
