import { useState } from 'react'
import { useAgUiChat } from '../hooks/useAgUiChat.js'

export function ChatPage() {
  const { messages, thinking, sendMessage, ready } = useAgUiChat()
  const [input, setInput] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !ready) return
    void sendMessage(input.trim())
    setInput('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              textAlign: m.role === 'user' ? 'right' : 'left',
              marginBottom: '0.5rem',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                padding: '0.5rem 0.75rem',
                borderRadius: '0.5rem',
                background: m.role === 'user' ? '#dbeafe' : '#f3f4f6',
              }}
            >
              {m.content}
            </span>
          </div>
        ))}
        {thinking && (
          <div style={{ color: '#9ca3af', fontStyle: 'italic' }} aria-live="polite">
            Thinking…
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', gap: '0.5rem', padding: '1rem', borderTop: '1px solid #e5e7eb' }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message…"
          disabled={!ready}
          style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
        />
        <button type="submit" disabled={!ready || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  )
}
