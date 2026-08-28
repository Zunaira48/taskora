# Taskora — AI Architecture

This document explains how AI is integrated into Taskora: the provider abstraction, how prompts are designed, how structured output is validated, how user data isolation is enforced for AI features specifically, and how failures are handled. For the rest of the system (auth, database, deployment), see [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Provider

**Google Gemini**, model `gemini-3.1-flash-lite`, accessed via the official `@google/genai` Node SDK.

This was chosen deliberately, not by default:
- Gemini has a genuine free tier suitable for a zero-budget project
- `gemini-3.1-flash-lite` is Google's current cost-efficient tier — not a preview build, reducing the risk of sudden deprecation, and cheaper than comparable alternatives if the project ever needed to move to paid usage
- The model name is stored in an environment variable (`GEMINI_MODEL`), not hardcoded — Google's model lineup changes over time (an older model used during early research, `gemini-2.0-flash-lite`, was deprecated mid-project), so swapping models later requires a config change, not a code change

## Architecture Constraint: Backend-Only

```
Browser → Taskora backend → Gemini API → Taskora backend → Browser
```

The frontend **never** calls Gemini directly. The API key exists only as a server-side environment variable on Render — it is never sent to, or reachable by, the browser. Every AI feature is a normal authenticated Taskora API route; from the frontend's perspective, calling `/api/ai/breakdown` looks identical to calling `/api/tasks`.

---

## Provider Abstraction

```
backend/services/ai/
├── geminiProvider.js   — the only file that knows Gemini exists
├── aiService.js        — what every route actually calls
├── prompts.js           — prompt templates, one per feature
└── schemas.js           — response schemas + validation functions
```

`geminiProvider.js` exposes two low-level functions: `generateText()` for free-form responses (used only by Copilot) and `generateJSON()` for structured, schema-constrained responses (used by every other feature). `aiService.js` is the layer every route actually imports — it composes a prompt builder, a Gemini call, and a validator into one feature function (e.g. `breakdownTask()`, `recommendPriority()`).

The point of this split: if a second AI provider were ever added — a fallback if Gemini is down, or a cheaper model for simpler requests — that logic would live in `aiService.js`, and nothing in `server.js` or `geminiProvider.js` would need to change. No route handler anywhere references Gemini by name.

---

## Structured Output Strategy

Every feature except Copilot uses Gemini's structured output mode: a `responseSchema` (an OpenAPI-style JSON schema) is passed alongside the prompt, constraining Gemini to return JSON matching that shape. This is far more reliable than asking for JSON in plain text and hoping the model doesn't wrap it in markdown fences or explanatory prose.

**Copilot is the one exception.** It's conversational and open-ended by nature — there's no fixed shape to constrain a free-text answer to, so it uses `generateText()` instead. The tradeoff is explicit: Copilot's prompt includes an instruction ("never invent tasks that aren't in the list above") as the *only* anti-hallucination guard, since there's no schema to programmatically enforce it against. Every other feature has both an instructional guard *and* a code-level one — see Validation below.

---

## Prompt Design

Each feature's prompt (`prompts.js`) follows the same pattern: state today's date **and day name** explicitly, provide only the data actually needed for that specific request, and give clear, constrained instructions about the expected output.

The day-name detail matters more than it sounds: an early version of the Smart Task Creation prompt gave Gemini only an ISO date string and asked it to resolve relative dates like "by Friday." It got this wrong (returned the current day as "Friday" instead of the next one) — because the model had to silently infer what day of the week the ISO date fell on before it could reason about "Friday" at all. Providing the day name directly (`"Today is Thursday, 2026-08-27"`) removed that inference step entirely and fixed the bug. This is a good example of why AI features need to be *tested against real output*, not just assumed correct from a well-written prompt.

---

## Validation — AI Output Is Untrusted Input

Every structured response is re-validated in `schemas.js` after parsing, regardless of the schema constraint already applied at the API level. This is deliberate defense in depth, not redundancy:

- **String lengths are capped** (e.g. task titles truncated to 255 characters) regardless of what Gemini returned
- **Enums are strictly checked** — an invalid `priority` value falls back to a safe default rather than being trusted
- **Array sizes are hard-capped** (e.g. task breakdown limited to 10 subtasks, Plan My Day's plan limited to 10 items) even if the model returned more
- **Dates are pattern-matched** against `YYYY-MM-DD` — anything that doesn't match becomes `null` rather than being passed through
- **The Plan My Day hallucination guard:** the route builds a `Set` of the exact task IDs actually sent to Gemini, and the validator drops any entry in the response referencing an ID outside that set. This directly defends against the model inventing or misremembering a task that was never in its context.
- **Copilot's conversation history is sanitized server-side** before being included in a prompt — entries with an invalid `role`, missing `content`, or malformed shape are filtered out. This was specifically tested against a simulated injection attempt (a fake `role: "system"` entry trying to smuggle an instruction into the conversation) to confirm it's actually rejected, not just assumed to be.

If validation fails outright (e.g. a response with no usable subtasks at all), the function throws, which the route handler catches and turns into the standard graceful-failure response — never a raw error surfaced to the user.

---

## User-Context Isolation

Every AI feature that involves existing task data fetches that data **itself, server-side, scoped by the authenticated user's ID** — never trusting anything the client claims about task state.

- **Priority Recommendation** looks up the specific task by `id`, but the query is `WHERE id = $1 AND user_id = $2` — identical isolation pattern to every other task route. A user cannot get an AI recommendation about a task they don't own, because the query simply returns nothing if the IDs don't match together.
- **Plan My Day** and **Copilot** both query `WHERE user_id = $1`, fetching only that user's open tasks (capped at 20, ordered by due date) — never the whole `tasks` table, and never another user's rows.
- No AI response is ever cached or reused across requests or users — every message, even in a single Copilot conversation, triggers a fresh, freshly-scoped database query.

This mirrors the same isolation principle enforced everywhere else in the app (see `ARCHITECTURE.md`), applied specifically to the AI layer.

---

## Rate Limiting & Free-Tier Protection

Four separate rate-limit tiers, matched to how expensive and how frequently each kind of request should reasonably occur:

| Limiter | Scope | Limit |
|---|---|---|
| `generalLimiter` | All `/api/` routes | 300 / 15 min |
| `authLimiter` | Register, login | 20 / 15 min |
| `aiLimiter` | Breakdown, Smart Task, Priority, Plan My Day | 20 / 15 min |
| `copilotLimiter` | Copilot | 40 / 15 min (conversational, needs more turns) |

Combined with the hard caps in validation (max subtasks, max plan items, max response length on Copilot replies), this keeps any single user's usage bounded even under heavy or automated use — protecting the shared Gemini free-tier quota from being exhausted by one runaway client.

---

## Failure Handling

Every AI route follows the identical pattern:

```javascript
try {
  // build context, call aiService, respond
} catch (err) {
  console.error('AI <feature> failed:', err.message); // real detail, server-side only
  res.status(503).json({ error: 'AI is temporarily unavailable. Your Taskora data is safe.' });
}
```

This was tested directly — a simulated Gemini timeout produces exactly this 503 response, with the underlying error logged server-side but never exposed to the client. The wording is deliberate: it reassures the user their actual task data (the thing they care about) is unaffected by an AI outage, because it genuinely is — no AI feature can block or break the core task manager, since AI calls only ever happen on explicit user action (clicking a button), never automatically on page load or navigation.
