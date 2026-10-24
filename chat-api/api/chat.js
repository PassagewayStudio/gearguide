/**
 * Garagewiki Chat API
 * Vercel Serverless Function — POST /api/chat
 *
 * Flow:
 *   1. Receive { query, threadId? }
 *   2. RAG: fetch approved manuals / common_issues / exploded_diagrams from Supabase
 *   3. Call an OpenAI-compatible LLM (stream not required for MVP) with the context
 *   4. Return { answer, sources, threadId }
 *
 * The handler is split into `createChatHandler(opts)` so it can be tested with
 * in-memory fakes. `export default` is the real request handler Vercel calls.
 *
 * Vercel env vars:
 *   OPENAI_API_KEY, OPENAI_MODEL (default gpt-4o-mini), OPENAI_BASE_URL (default https://api.openai.com/v1)
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
 *   SITE_URL (default https://gearguide-tau.vercel.app)
 */

import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

const SITE_URL = process.env.SITE_URL || 'https://gearguide-tau.vercel.app'

const TABLES = {
  manuals: 'manuals',
  common_issues: 'common_issues',
  exploded_diagrams: 'exploded_diagrams',
}

// Mirrors the free-text $search columns in src/lib/db.js
const SEARCH_FIELDS = {
  manuals: ['title', 'make', 'model', 'category', 'description', 'source'],
  common_issues: ['title', 'make', 'model', 'category', 'symptoms', 'solution'],
  exploded_diagrams: ['title', 'make', 'model', 'category', 'system', 'description', 'parts'],
}

const MAX_TOKENS = 6   // max query words to search on
const MAX_RESULTS = 6  // max entries surfaced to the LLM

export const SYSTEM_PROMPT = `You are "GarageWiki AI", an expert auto-troubleshooting assistant for the community wiki at ${SITE_URL}.

Your job: give community members clear, accurate, safety-aware answers drawn ONLY from the reference material you are given. Do not invent information.

RULES:
1. Answer only from the "Reference material" sections below. The wiki is your source of truth.
2. If the reference material does not cover the question, say so plainly. Offer what info would help, but never fabricate a fix, part number, or torque spec.
3. Prefer the exact part numbers, torque specs, and step-by-step procedures from the manual when they exist.
4. Cite your sources. Mark each sourced claim with a plain-number citation like [1] or [2], and always finish with a "Sources:" list giving each source's title AND its full URL (a click-through link), e.g.:
     Source 1: 1990 Toyota Celica All-Trac/4WD Repair Manual — https://gearguide-tau.vercel.app/view/manuals/<id>
5. Keep answers focused for a DIY mechanic: numbered steps, short bullets, and short paragraphs. Put safety warnings (e.g. "disconnect the battery", "never work under a car on a jack") front and centre.
6. Do not ask for personal info, logins, or account details.

QUESTIONS TO ASK YOURSELF BEFORE ANSWERING:
- "Did I use a source for every factual claim?" If not, cite it or drop the claim.
- "Is every URL complete and clickable?"
- "Would a stranger understand this without reading the wiki first?"`

// -----------------------------------------------------------------------
// RAG
// -----------------------------------------------------------------------

function tokenize(query) {
  return String(query)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, MAX_TOKENS)
}

function buildOrRls(table, token) {
  const fields = SEARCH_FIELDS[table] || []
  const conditions = fields.map((f) => `${f}.ilike.*${token}*`).join(',')
  return `or(${conditions})`
}

// Fetch approved rows and score them by how many query tokens they hit.
async function fetchRelated(db, query) {
  const tokens = tokenize(query)
  const seen = new Set()
  const candidates = []

  for (const [type, table] of Object.entries(TABLES)) {
    for (const token of tokens) {
      const { data, error } = await db.from(table).select('*').eq('status', 'approved').or(buildOrRls(table, token))
      if (error) throw error
      for (const row of (data || [])) {
        if (!seen.has(row.id)) {
          seen.add(row.id)
          candidates.push({ ...row, type })
        }
      }
    }
  }

  const scored = candidates
    .map((c) => {
      let score = 0
      const haystack = `${c.title} ${c.make ?? ''} ${c.model ?? ''} ${c.category ?? ''} ${c.description ?? ''} ${c.symptoms ?? ''} ${c.solution ?? ''} ${c.parts ?? ''}`.toLowerCase()
      for (const token of tokens) {
        if (haystack.includes(token)) score += 2
      }
      // Title matches are the strongest signal.
      if (c.title.toLowerCase().includes(tokens[0]?.toLowerCase())) score += 3
      return { ...c, score }
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS)

  return scored
}

// -----------------------------------------------------------------------
// LLM call (OpenAI-compatible)
// -----------------------------------------------------------------------

async function callLlm(fetchFn, query, context) {
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
  const base = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('OPENAI_API_KEY is not set. Add it in Vercel Project Settings > Environment Variables.')

  const parts = [`Use the reference material below to answer the user's question.`, '']
  if (context) {
    parts.push('Reference material:', context, '---')
  } else {
    parts.push('No reference material matched your question. If you know the answer from general knowledge, you may answer it, but clearly flag that it is not from the wiki. Otherwise say you could not find it.')
  }
  const userText = parts.join('\n')

  const payload = {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userText },
    ],
    temperature: 0.2,
    max_tokens: 900,
  }

  const response = await fetchFn(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`LLM request failed (${response.status}): ${body}`)
  }

  const json = await response.json()
  const answer = json?.choices?.[0]?.message?.content?.trim()
  if (!answer) throw new Error('LLM returned an empty response.')
  return answer
}

// -----------------------------------------------------------------------
// Handler
// -----------------------------------------------------------------------

function entryUrl(type, id) {
  return `${SITE_URL}/view/${type}/${id}`
}

function formatSources(sources) {
  return sources
    .map((s, i) => {
      const url = entryUrl(s.type, s.id)
      return `Source ${i + 1}: ${s.title} — ${url}`
    })
    .join('\n')
}

export function createChatHandler({ supabase: injectedSupabase, fetch: injectedFetch } = {}) {
  const db = injectedSupabase ?? createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
  const llmFetch = injectedFetch ?? ((input, init) => fetch(input, init))

  async function handler(req, res) {
    if (req.method !== 'POST') {
      res.statusCode = 405
      return res.end(JSON.stringify({ error: 'POST only' }))
    }

    let body = ''
    for await (const chunk of req) {
      body += chunk
    }
    let parsed
    try {
      parsed = body ? JSON.parse(body) : {}
    } catch {
      res.statusCode = 400
      return res.end(JSON.stringify({ error: 'Invalid JSON body' }))
    }

    const { query, threadId } = parsed
    if (!query || typeof query !== 'string' || !query.trim()) {
      res.statusCode = 400
      return res.end(JSON.stringify({ error: 'query (string) is required' }))
    }

    try {
      // ---- RAG ----
      const related = await fetchRelated(db, query)

      // ---- LLM ----
      const context = related.length
        ? related
            .map((r, i) => {
              const url = entryUrl(r.type, r.id)
              const detail = [r.make, r.model, r.category].filter(Boolean).join(' · ') || '—'
              return `${i + 1}. [${r.title}] (${r.type}) ${r.description ? 'Description: ' + r.description : ''}\n   Make/Model/Category: ${detail}\n   Source: ${url}`
            })
            .join('\n\n')
        : 'No community entries matched your question.'
      const answer = await callLlm(llmFetch, query, context)

      const sources = related.map((r) => ({ id: r.id, title: r.title, type: r.type, url: entryUrl(r.type, r.id) }))

      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      return res.end(JSON.stringify({
        answer,
        sources,
        threadId: threadId || randomUUID(),
        ok: true,
      }))
    } catch (err) {
      console.error('[chat]', err)
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      return res.end(JSON.stringify({ error: 'Chat failed', detail: err.message }))
    }
  }

  return handler
}

// Real request handler for Vercel. The module-level `db` client is created
// lazily on first request so tests can inject fakes before any call.
let defaultHandler = null
function getDefaultHandler() {
  if (!defaultHandler) {
    defaultHandler = createChatHandler()
  }
  return defaultHandler
}

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
export const db = supabase
export default getDefaultHandler()
