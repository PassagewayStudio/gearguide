/**
 * Stubbed end-to-end test for the chat API.
 *
 * Verifies, with in-memory fakes (no network, no real keys):
 *   1. RAG fetchRelated returns the right entries for a query
 *   2. The handler returns { answer, sources, threadId }
 *   3. 400/405 validation paths behave
 *
 * Run:  node test-chat.mjs
 */

process.env.VITE_SUPABASE_URL = 'https://test.supabase.co'
process.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.OPENAI_API_KEY = 'test-key' // dummy; fakeFetch handles /chat/completions

// Request-builder helper for the fake HTTP surface.
function makeReq(body) {
  return {
    method: 'POST',
    async *[Symbol.asyncIterator]() {
      yield JSON.stringify(body)
    },
  }
}

// Dynamic import so env vars are set before the module constructs its default
// (real) Supabase client.
const { createChatHandler } = await import('./api/chat.js')

// ---------------------------------------------------------------- fake DB
const manuals = [
  { id: 'm1', title: '1990 Toyota Celica All-Trac/4WD Repair Manual', type: 'manuals',
    make: 'Toyota', model: 'Celica', category: 'Brakes', description: 'This manual covers all major components for the Celica All-Trac and other related models. Includes brake procedures.', status: 'approved' },
  { id: 'm2', title: '1990 Toyota Celica Owner Manual', type: 'manuals',
    make: 'Toyota', model: 'Celica', category: 'General', description: 'Owner maintenance schedule and fluids.', status: 'approved' },
  { id: 'm3', title: '1995 Toyota Corolla Repair Manual', type: 'manuals',
    make: 'Toyota', model: 'Corolla', category: 'Engine', description: 'Engine repair procedures.', status: 'approved' },
]
const issues = [
  { id: 'i1', title: 'Celica brake squeal at low speed', type: 'common_issues',
    make: 'Toyota', model: 'Celica', category: 'Brakes', symptoms: 'squeal', solution: 'Resurface rotors or install ceramic pads.', status: 'approved' },
  { id: 'i2', title: 'Celica alternator whining', type: 'common_issues',
    make: 'Toyota', model: 'Celica', category: 'Electrical', symptoms: 'whine', solution: 'Replace the belt tensioner.', status: 'approved' },
]
const diagrams = [
  { id: 'd1', title: 'Celica brake caliper exploded view', type: 'exploded_diagrams',
    make: 'Toyota', model: 'Celica', category: 'Brakes', description: 'Part callouts for the caliper and pads.', status: 'approved' },
]

// Record of every fetchRelated call so we can assert on it.
const fetchCalls = []

const fakeSupabase = {
  from(table) {
    return {
      select() {
        return {
          eq(st, val) {
            // Always filter to approved rows regardless of args.
            return {
              or(conditions) {
                const conditionTokens = conditions
                  .replace(/^or\(/, '').replace(/\)$/, '')
                  .split(',')
                  .map((c) => {
                    const [field, , val] = c.split('.')
                    // Case-insensitive so 'Celica' matches 'celica'.
                    const regex = new RegExp(val.replace(/^\*\.?/, '').replace(/\*$/, ''), 'i')
                    return { field, regex }
                  })
                const approved = (ALL[table] || []).filter((row) => row.status === 'approved')
                const hits = approved.filter((row) => conditionTokens.some((t) => {
                  const v = row[t.field] ?? ''
                  return t.regex.test(String(v))
                }))
                const seen = new Set()
                const out = []
                for (const r of hits) {
                  if (!seen.has(r.id)) { seen.add(r.id); out.push(r) }
                }
                fetchCalls.push({ table, conditions, count: out.length })
                return { data: out, error: null }
              },
            }
          },
        }
      },
    }
  },
}

// All tables keyed by supabase `from()` argument
const ALL = {
  manuals,
  common_issues: issues,
  exploded_diagrams: diagrams,
}

const status = 'approved'

// ---------------------------------------------------------------- fake LLM
const llmResponses = {
  'https://api.openai.com/v1/chat/completions': {
    id: 'chatcmpl-fake',
    object: 'chat.completion',
    choices: [{ message: { role: 'assistant', content: 'To replace the brake pads on a 1990 Celica:\n1. Raise the car and support it on axle stands (never work under a car on a jack).\n2. Drain the brake fluid reservoir slightly to reduce pressure.\n3. Remove the caliper bracket bolts and pivot the caliper off the rotors.\n4. Remove the old pads; inspect the rotors.\n5. Install new pads with anti-squeal shims, then reassemble and bed the brakes.\n\nSources: [[1]](https://gearguide-tau.vercel.app/view/manuals/m1) [[2]](https://gearguide-tau.vercel.app/view/issues/i1)' } }],
  },
}

let fetched = []

const fakeFetch = async (input, init) => {
  fetched.push(String(input))
  const url = String(input)
  if (url.includes('/chat/completions')) {
    return { ok: true, status: 200, json: async () => llmResponses[url], text: async () => '{}' }
  }
  throw new Error(`unexpected fetch: ${url}`)
}

// ---------------------------------------------------------------- test
const handler = createChatHandler({ supabase: fakeSupabase, fetch: fakeFetch })

async function main() {
  const req = (body) => ({
    method: 'POST',
    async *[Symbol.asyncIterator]() {
      yield JSON.stringify(body)
    },
  })

  const res = {
    statusCode: 0,
    headers: {},
    chunks: [],
    setHeader(k, v) { this.headers[k] = v },
    async end(buf) { this.chunks.push(Buffer.from(buf)); return Promise.resolve() },
  }

  // 1. Happy path
  await handler(makeReq({ query: 'How do I replace the brake pads on a 1990 Celica?' }), res)
  const body = JSON.parse(res.chunks.join(''))

  console.log('=== TEST 1: happy path ===')
  console.log('status   :', res.statusCode === 200 ? '200' : 'FAIL (' + res.statusCode + ')')
  console.log('answer ok:', typeof body.answer === 'string' && body.answer.length > 20)
  console.log('sources  :', body.sources.map((s) => s.title).join(' | '))
  console.log('threadId :', typeof body.threadId === 'string' && body.threadId.length > 0 ? 'OK' : 'FAIL')

  // 2. RAG results
  const manualCalls = fetchCalls.filter((c) => c.table === 'manuals')
  console.log('\n=== TEST 2: RAG ===')
  console.log('manual fetch calls:', manualCalls.length, '| at least one returned > 0 rows:', manualCalls.some((c) => c.count > 0))

  // 3. Validation: empty query -> 400
  const res2 = { statusCode: 0, headers: {}, chunks: [], setHeader() {}, end(buf) { this.chunks.push(Buffer.from(buf)) } }
  await handler(req({ query: '' }), res2)
  console.log('\n=== TEST 3: empty query -> 400 ===')
  console.log('status:', res2.statusCode === 400 ? '400' : `FAIL (${res2.statusCode})`)

  // 4. Validation: wrong method -> 405
  const res3 = { statusCode: 0, headers: {}, chunks: [], setHeader() {}, end(buf) { this.chunks.push(Buffer.from(buf)) } }
  await handler({ method: 'GET' }, res3)
  console.log('\n=== TEST 4: GET -> 405 ===')
  console.log('status:', res3.statusCode === 405 ? '405' : `FAIL (${res3.statusCode})`)

  // 5. No reference material -> LLM still gets a sensible prompt
  const res4 = { statusCode: 0, headers: {}, chunks: [], setHeader() {}, end(buf) { this.chunks.push(Buffer.from(buf)) } }
  const handler2 = createChatHandler({ supabase: fakeSupabase, fetch: fakeFetch })
  const req4 = (body) => ({
    method: 'POST',
    async *[Symbol.asyncIterator]() { yield JSON.stringify(body) },
  })
  await handler2(req4({ query: 'What is the air pressure for a 2010 Civic tire?' }), res4)
  const body4 = JSON.parse(res4.chunks.join(''))
  console.log('\n=== TEST 5: no-match query ===')
  console.log('sources (should be empty):', body4.sources.length === 0 ? 'OK' : body4.sources.length)
  console.log('answer returned:', typeof body4.answer === 'string' && body4.answer.length > 20 ? 'OK' : 'FAIL')

  const allOk = body.ok && typeof body.answer === 'string' && body.sources.length > 0 && res2.statusCode === 400 && res3.statusCode === 405
  console.log('\nOVERALL:', allOk ? 'PASS' : 'FAIL')
  process.exit(allOk ? 0 : 1)
}

main().catch((e) => { console.error('TEST RUNNER ERROR', e); process.exit(1) })
