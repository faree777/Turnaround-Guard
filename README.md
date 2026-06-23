# Turnaround Guard

A fleet conflict console for small car rental operators. It watches the gap between
back-to-back bookings on the same vehicle, flags the moment a late return threatens
the next guest's pickup, and walks the operator through resolving it — start to
finish — before the next guest ever finds out something's wrong.

## The problem

Small rental operators (1Now's core users) don't run a big agency with spare
inventory. The car a guest booked is the only car that exists for that slot. So
when a rental runs late, there's no swap-the-fleet move available by default —
the next booking on that same car is now directly at risk, and the failure mode
is brutal: late return → next guest shows up to nothing → cancellation → refund
fight → bad review. All from one missed signal, usually caught only when it's
already a crisis.

This isn't a damage-claim problem (the obvious example in the brief). It's an
earlier, more frequent, more preventable one: **catching the conflict while
there's still time to act**, and then actually acting — fast, with the right
tradeoffs laid out — instead of improvising a text message at 11pm.

## What it does

- **Detects risk automatically.** A live "now" line sweeps across a runway view
  of the whole fleet (one lane per vehicle). As a return clock ticks past due,
  the system computes the shrinking buffer against the next booking and
  escalates: clear → watch → late → conflict.
- **Doesn't cry wolf.** Most lanes stay quiet the whole time. A punctual renter
  who returns early resolves back to clear on its own — the system isn't just
  flagging "is the rental near its end," it's flagging actual risk to the next
  guest.
- **Generates real resolution options, not a single canned response.** When a
  conflict fires, Groq (using Llama 3.3) looks at the specific situation — how
  late, how much buffer is left, both renters' histories, whether a same-class
  vehicle is sitting idle elsewhere in the fleet — and proposes three ranked
  options with honest tradeoffs (swap the next guest to another car, hold the
  line and push the late renter, or proactively offer a credit). One is marked
  recommended, with reasoning, but the operator decides.
- **Drafts the actual messages.** Once an option is picked, Groq writes the
  two messages that need to go out — to the late renter and to the next guest —
  in send-ready form, reflecting the specific commitment being made (a swap, a
  credit, a deadline). The operator reviews and sends. Conflict closes out.
- **Handles the edge that actually matters: no good option exists.** If there's
  no idle vehicle to swap to, the option set adapts — it won't suggest a swap
  that doesn't exist. The engine reasons from the live fleet state every time,
  not from a fixed script.

## Why this shape, not a chatbot

The instinct for "AI handles a customer problem" is usually a single drafted
reply. That's not how this decision actually gets made. An operator staring at
a blown turnaround is choosing between real tradeoffs — swap costs you the
exact-car promise, holding the line risks the guest never shows, a credit costs
money even if it turns out fine. Groq's job here is to lay out that decision
clearly and fast, then execute the writing once a human has picked a direction.
The detection (when is this actually a risk) is deterministic and instant — no
need to wait on a model call just to notice a clock is ticking down.

## Architecture

```
src/
  data/seed.js          scripted fleet + bookings for the demo
  lib/risk.js            pure risk-detection engine (no React, no AI — testable on its own)
  lib/useSimClock.js     drives the demo's simulated "now"
  components/
    RunwayView.jsx        the fleet timeline (signature view)
    ConflictPanel.jsx      conflict detail + resolution flow
    ClockBar.jsx           play/pause/speed/scrub controls
server.js                 tiny Express API: two endpoints, both backed by Groq
                           (llama-3.3-70b-versatile) with a deterministic fallback if no
                           API key is configured, so the repo runs out of the box
```

The risk engine is intentionally separate from any AI call — buffer math should
never depend on a model being available or fast. AI reasoning only enters once
something is already confirmed to need a human decision.

## Running it

```bash
npm install
cp .env.example .env   # add GROQ_API_KEY for live Groq reasoning
npm run dev:all        # starts the web app (5173) and the resolution API (8787) together
```

Open http://localhost:5173. Press play on the clock bar (top), or drag the
scrubber to jump ahead. Watch the Civic lane: clear → watch → late → conflict.
Click the flag to open the resolution panel.

Without a `GROQ_API_KEY`, the app still runs completely — the server
falls back to deterministic, scenario-aware option generation and message
drafting so the flow is fully demoable with zero setup. Add a key to see Groq
reason live over the specific fleet context.

## Setup

1. **Get a Groq API key**: Sign up at [Groq](https://console.groq.com) and create an API key
2. **Configure the environment**: Create a `.env` file from the template:
   ```bash
   cp .env.example .env
   ```
3. **Add your API key**: Edit `.env` and paste your Groq API key:
   ```
   GROQ_API_KEY=gsk_YOUR_API_KEY_HERE
   PORT=8787
   ```
4. **Install and run**:
   ```bash
   npm install
   npm run dev:all
   ```

## What I'd do next

- Replace the scripted clock with real booking data (this would plug into
  1Now's existing booking records — the risk engine only needs start/end times
  and a vehicle ID, it doesn't care where they come from).
- Push the "watch" state as a passive nudge to the operator's phone before it
  ever reaches "late," so the swap decision can happen before the late renter
  even notices anything's wrong.
- Track actual outcomes (was the recommended option taken? did it work?) to
  tune which option gets marked recommended over time, per operator.

