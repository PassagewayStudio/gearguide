# Garagewiki Chat API

A Vercel Serverless Function that answers questions for the Garagewiki community
wiki by **retrieving (RAG) the latest approved manuals, common issues, and
exploded diagrams from Supabase**, then calling an **OpenAI-compatible LLM**.

## How it works

```
Client              Chat API (this function)          Supabase                LLM
  |  POST /api/chat  |  (1) tokenize query           |  approved rows        |  RAG context
  |                  |  (2) fetch related entries    <---------------------- |  (3) call /chat/completions
  |                  |  (4) build prompt + context   |                       |  (5) stream answer
  |                  |  (6) return { answer, sources }|                       |
  |                  |  (7) render sources as links  |                       |
```

The LLM is instructed to answer **only from the reference material**, cite each
claim (`[1]`), and end with a clickable `Sources:` list that points back to the
wiki entries.

## Files

| Path | Purpose |
| --- | --- |
| `api/chat.js` | The serverless function (handler, RAG, LLM call, env-driven). |
| `package.json` | Node deps (`@supabase/supabase-js`). |
| `vercel.json` | Tells Vercel the function lives in `api/chat.js`. |
| `test-chat.mjs` | Stubbed end-to-end test (no network/keys). Run with `npm test`. |

## Setup

1. **Push `chat-api/` to its own GitHub repo** (e.g. `gearguide-chat`).

2. **Connect it to Vercel** as a new project (Import → GitHub → `gearguide-chat`).

3. **Add Environment Variables** (Project Settings → Environment Variables):

   | Key | Value | Required |
   | --- | --- | --- |
   | `OPENAI_API_KEY` | Your provider key (OpenAI / OpenRouter / xAI) | yes |
   | `OPENAI_MODEL` | Model, e.g. `gpt-4o-mini` | no (default) |
   | `OPENAI_BASE_URL` | e.g. `https://api.openai.com/v1` | no (default) |
   | `VITE_SUPABASE_URL` | `https://<your-project>.supabase.co` | yes |
   | `VITE_SUPABASE_ANON_KEY` | your Supabase anon key | yes |
   | `SITE_URL` | `https://gearguide-tau.vercel.app` (optional) | no |

4. **Deploy**. The function is served at `/api/chat`.

## Frontend widget

Drop `src/components/ChatWidget.jsx` + the `ChatWidget` import into `src/main.jsx`
(shown in this repo). Set `VITE_CHAT_URL` (default `/api/chat`) so the widget
points at the right chat function. Add the trigger button wherever you like.

## Test

```bash
npm install
npm test
```

The test uses in-memory fake Supabase + a canned LLM response — no real keys or
network needed.

## Notes

- Only **approved** wiki entries are served, so unmoderated content never leaves
  the database.
- The LLM is called via any **OpenAI-compatible** endpoint, so you can use
  OpenAI, OpenRouter, xAI, or a local proxy without changing the function code.
- Streaming is intentionally not included in this MVP; responses are returned in
  one payload and the UI shows a typing indicator.
