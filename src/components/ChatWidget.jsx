/**
 * Garagewiki Chat Widget
 *
 * Floating "Ask the wiki" button + inline chat panel on every page.
 * Talks to the chat API at $VITE_CHAT_URL (defaults to /api/chat, same origin).
 *
 * Design tokens match the garagewiki theme (amber accents on dark/zinc).
 */

import { useEffect, useRef, useState, Fragment } from 'react'
import { MessageSquare, X, Send, Wrench } from 'lucide-react'

const CHAT_URL = import.meta.env.VITE_CHAT_URL || '/api/chat'
const MAX_CHARS = 4000

export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [error, setError] = useState('')
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const panelRef = useRef(null)
  const inputRef = useRef(null)

  // Keep the panel closed when clicking outside.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  // Focus input when panel opens.
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0)
  }, [open])

  const send = async (text) => {
    const q = (text || input).trim()
    if (!q || thinking) return
    setInput('')
    setError('')
    setMessages((m) => [...m, { role: 'user', content: q }])

    try {
      setThinking(true)
      const res = await fetch(CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Chat failed')
      setMessages((m) => [...m, { role: 'assistant', content: data.answer, sources: data.sources }])
    } catch (err) {
      setError(err.message || 'Could not reach the chat server.')
    } finally {
      setThinking(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    send(input)
  }

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 max-w-sm">
      {/* Trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="pointer-events-auto flex items-center gap-2 rounded-full bg-amber-500 px-4 py-3 text-zinc-900 shadow-lg transition hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2"
        aria-expanded={open}
        aria-label={open ? 'Close chat' : 'Open chat'}
      >
        <MessageSquare className="h-5 w-5" />
        <span className="hidden text-sm font-semibold sm:inline">Ask the wiki</span>
      </button>

      {/* Panel */}
      <div
        ref={panelRef}
        className={`pointer-events-auto flex flex-col gap-3 overflow-hidden rounded-2xl border bg-zinc-900 text-zinc-100 shadow-2xl transition-transform duration-200 ${open ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'}`}
        style={{ maxHeight: '60vh', maxWidth: '100%', width: '100%' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-700/60 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Wrench className="h-4 w-4 text-amber-400" />
            <span className="tracking-wide">GarageWiki AI</span>
            <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-400">beta</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="rounded p-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {messages.map((m, i) => (
            <MessageBubble key={i} message={m} thinking={thinking && i === messages.length - 1} />
          ))}
          {thinking && !messages.length && (
            <div className="flex items-center gap-2 text-zinc-400 justify-center">
              <span className="h-2 w-2 animate-ping rounded-full bg-amber-400" />
              <span className="h-2 w-2 rounded-full bg-amber-400" />
            </div>
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-zinc-700/60 px-3 py-3">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about a car, a symptom, or a fix…"
            className="flex-1 rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
            maxLength={MAX_CHARS}
          />
          <button
            type="submit"
            disabled={!input.trim() || thinking}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 text-zinc-900 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>

      {error && (
        <p className="text-xs text-zinc-400 text-right">{error}</p>
      )}
    </div>
  )
}

// ----------------------------------------------------------------------
function MessageBubble({ message, thinking }) {
  const isUser = message.role === 'user'

  if (thinking) {
    return (
      <div className="flex justify-center py-2">
        <div className="h-2 w-2 rounded-full bg-zinc-500 animate-bounce" />
        <div className="h-2 w-2 rounded-full bg-zinc-500 animate-bounce [animation-delay:0.18s]" />
        <div className="h-2 w-2 rounded-full bg-zinc-500 animate-bounce [animation-delay:0.36s]" />
      </div>
    )
  }

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-zinc-700/80 px-4 py-2 text-sm text-zinc-100">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-zinc-800/80 px-4 py-3">
        {renderMarkdown(message.content)}
        {message.sources && message.sources.length > 0 && (
          <ul className="mt-2 border-t border-zinc-700/60 pt-2 text-xs text-zinc-400">
            {message.sources.map((s, i) => (
              <li key={i}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-400 underline underline-offset-2"
                >
                  {s.title} ({s.type})
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------
// Tiny markdown renderer: headings, ordered/bulleted lists, bold, citations.
// Builds React elements (no dangerouslySetInnerHTML).
// ----------------------------------------------------------------------
function renderMarkdown(text) {
  const blocks = text.split(/\n\s*\n/)
  return blocks.map((block, bi) => {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean)
    if (!lines.length) return null

    const first = lines[0]

    if (/^#{1,3}\s/.test(first)) {
      const level = first.match(/^#+/)[0].length
      return (
        <ElementBlock key={bi} level={level}>
          {renderInline(first.slice(level + 1))}
        </ElementBlock>
      )
    }

    if (/^\d+\.\s/.test(first.trim())) {
      const items = []
      for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(/^(\d+)\.\s+(.*)$/)
        if (m) {
          items.push({ num: m[1], text: m[2] })
        } else if (items.length) {
          items[items.length - 1].text += ' ' + lines[i]
        }
      }
      return (
        <ol key={bi} style={{ margin: '0.5em 0' }}>
          {items.map((it, i) => (
            <li key={i}>{renderInline(it.text)}</li>
          ))}
        </ol>
      )
    }

    if (lines.every((l) => /^[-*]\s/.test(l))) {
      return (
        <ul key={bi} style={{ margin: '0.5em 0' }}>
          {lines.map((l, i) => (
            <li key={i}>{renderInline(l.replace(/^[-*]\s*/, ''))}</li>
          ))}
        </ul>
      )
    }

    return <p key={bi} style={{ margin: '0.5em 0', whiteSpace: 'pre-line' }}>{renderInline(first)}</p>
  })
}

function renderInline(text) {
  const parts = []
  const regex = /(\*\*[^*]+?\*\*|\[\d+\])/g
  let last = 0
  let m
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push({ type: 'text', value: text.slice(last, m.index) })
    const token = m[0]
    if (token.startsWith('**')) parts.push({ type: 'bold', value: token.slice(2, -2) })
    else parts.push({ type: 'cite', value: token.slice(1, -1) })
    last = m.index + token.length
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) })
  return (
    <Fragment>
      {parts.map((p, i) => {
        if (p.type === 'text') return <span key={i}>{escapeHtml(p.value)}</span>
        if (p.type === 'bold') return <strong key={i}>{escapeHtml(p.value)}</strong>
        return (
          <span key={i} className="text-amber-400 underline decoration-amber-400/30 underline-offset-2">
            [{p.value}]
          </span>
        )
      })}
    </Fragment>
  )
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function ElementBlock({ level, children }) {
  const Tag = `h${level}`
  return <Tag style={{ margin: '0.5em 0' }}>{children}</Tag>
}
