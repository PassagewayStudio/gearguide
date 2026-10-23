// Thin adapter that exposes the same call shapes the app used with the Base44 SDK
// (db.entities.X.filter/get/create/..., db.auth.*, db.integrations.Core.UploadPublicFile)
// on top of Supabase, so page components needed almost no changes.
import { supabase } from '@/lib/supabase'

const TABLES = {
  Manual: 'manuals',
  CommonIssue: 'common_issues',
  ExplodedDiagram: 'exploded_diagrams',
  TroubleshootingStep: 'troubleshooting_steps',
}

// Columns searched (per table) by the free-text $search filter.
const SEARCH_FIELDS = {
  manuals: ['title', 'make', 'model', 'category', 'description', 'source'],
  common_issues: ['title', 'make', 'model', 'category', 'symptoms', 'solution'],
  exploded_diagrams: ['title', 'make', 'model', 'category', 'system', 'description', 'parts'],
  troubleshooting_steps: ['step', 'notes'],
}

// Split a search string into safe tokens (strips characters that are special inside PostgREST filters).
const searchTokens = (text) =>
  String(text)
    .replace(/[^\p{L}\p{N}\s.'-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)

const BUCKET = 'uploads'

const unwrap = ({ data, error }) => {
  if (error) throw error
  return data
}

// Escape LIKE wildcards so user search text is matched literally.
const escapeLike = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`)

function makeEntity(table) {
  return {
    // filter({ make: 'Honda', title: { $regex: 'idle', $options: 'i' } }, { sort: '-created_date', limit: 60 })
    async filter(query = {}, { sort = '-created_date', limit = 100 } = {}) {
      let q = supabase.from(table).select('*')
      for (const [key, value] of Object.entries(query)) {
        if (key === '$search') {
          // Every word must match at least one searchable column (so "honda civic 2012" narrows results).
          for (const token of searchTokens(value)) {
            const ors = (SEARCH_FIELDS[table] || []).map((f) => `${f}.ilike.*${token}*`)
            if (/^\d{4}$/.test(token)) ors.push(`year.eq.${token}`)
            if (ors.length) q = q.or(ors.join(','))
          }
        } else if (value && typeof value === 'object' && '$regex' in value) {
          q = q.ilike(key, `%${escapeLike(String(value.$regex))}%`)
        } else {
          q = q.eq(key, value)
        }
      }
      const desc = sort.startsWith('-')
      q = q.order(sort.replace(/^-/, ''), { ascending: !desc }).limit(limit)
      return { items: unwrap(await q) }
    },

    async count(query = {}) {
      let q = supabase.from(table).select('*', { count: 'exact', head: true })
      for (const [key, value] of Object.entries(query)) q = q.eq(key, value)
      const { count, error } = await q
      if (error) throw error
      return count ?? 0
    },

    // list({ distinct: 'make' }) -> { items: ['Honda', 'Toyota', ...] }
    async list({ distinct } = {}) {
      if (!distinct) return { items: unwrap(await supabase.from(table).select('*').limit(1000)) }
      const rows = unwrap(await supabase.from(table).select(distinct).limit(5000))
      const values = [...new Set(rows.map((r) => r[distinct]).filter(Boolean))]
      return { items: values.sort((a, b) => String(a).localeCompare(String(b))) }
    },

    async get(id) {
      return unwrap(await supabase.from(table).select('*').eq('id', id).single())
    },

    async create(data) {
      return unwrap(await supabase.from(table).insert(data).select().single())
    },

    async update(id, patch) {
      return unwrap(await supabase.from(table).update(patch).eq('id', id).select().single())
    },

    async delete(id) {
      const { error } = await supabase.from(table).delete().eq('id', id)
      if (error) throw error
    },

    // Anyone may mark an entry helpful; done server-side so the column can't be edited arbitrarily.
    async vote(id) {
      unwrap(await supabase.rpc('increment_helpful_votes', { p_table: table, p_id: id }))
      return this.get(id)
    },
  }
}

const entities = Object.fromEntries(Object.entries(TABLES).map(([name, table]) => [name, makeEntity(table)]))

const redirectUrl = (path) => `${window.location.origin}${path}`

const auth = {
  async isAuthenticated() {
    const { data } = await supabase.auth.getSession()
    return !!data.session
  },

  async me() {
    const { data, error } = await supabase.auth.getUser()
    if (error || !data.user) throw error || new Error('Not authenticated')
    return data.user
  },

  async loginViaEmailPassword(email, password) {
    unwrap(await supabase.auth.signInWithPassword({ email, password }))
  },

  // Creates the account and emails a 6-digit code (needs {{ .Token }} in the Confirm signup email template).
  async register({ email, password }) {
    unwrap(await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectUrl('/') } }))
  },

  async verifyOtp({ email, otpCode }) {
    return unwrap(await supabase.auth.verifyOtp({ email, token: otpCode, type: 'signup' }))
  },

  async resendOtp(email) {
    unwrap(await supabase.auth.resend({ type: 'signup', email }))
  },

  async loginWithProvider(provider, returnTo = '/') {
    unwrap(await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: redirectUrl(returnTo) } }))
  },

  async resetPasswordRequest(email) {
    unwrap(await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl('/reset-password') }))
  },

  // The recovery email link signs the user into a temporary session; we just set the new password.
  async resetPassword({ newPassword }) {
    unwrap(await supabase.auth.updateUser({ password: newPassword }))
  },

  async logout(redirectTo) {
    await supabase.auth.signOut()
    if (redirectTo) window.location.href = '/'
  },

  redirectToLogin(returnTo) {
    const target = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''
    window.location.href = `/login${target}`
  },
}

const integrations = {
  Core: {
    // Uploads to the public 'uploads' storage bucket and returns { file_url }.
    async UploadPublicFile({ file }) {
      const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')
      const path = `${new Date().getFullYear()}/${crypto.randomUUID()}.${ext}`
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type || undefined,
        cacheControl: '31536000',
      })
      if (error) throw error
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
      return { file_url: data.publicUrl }
    },
  },
}

export const db = { entities, auth, integrations }
