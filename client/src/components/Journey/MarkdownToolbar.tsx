import { Bold, Italic, Heading2, Link, Quote, List, ListOrdered, Minus } from 'lucide-react'

interface Props {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  onUpdate: (value: string) => void
  dark?: boolean
}

type FormatAction = { type: 'wrap'; before: string; after: string } | { type: 'line'; prefix: string }

const ACTIONS: Array<{ icon: typeof Bold; label: string; action: FormatAction }> = [
  { icon: Bold, label: 'Bold', action: { type: 'wrap', before: '**', after: '**' } },
  { icon: Italic, label: 'Italic', action: { type: 'wrap', before: '_', after: '_' } },
  { icon: Heading2, label: 'Heading', action: { type: 'line', prefix: '## ' } },
  { icon: Quote, label: 'Quote', action: { type: 'line', prefix: '> ' } },
  { icon: Link, label: 'Link', action: { type: 'wrap', before: '[', after: '](url)' } },
  { icon: List, label: 'List', action: { type: 'line', prefix: '- ' } },
  { icon: ListOrdered, label: 'Ordered', action: { type: 'line', prefix: '1. ' } },
  { icon: Minus, label: 'Divider', action: { type: 'line', prefix: '\n---\n' } },
]

export default function MarkdownToolbar({ textareaRef, onUpdate, dark }: Props) {
  const apply = (action: FormatAction) => {
    const ta = textareaRef.current
    if (!ta) return

    const start = ta.selectionStart
    const end = ta.selectionEnd
    const text = ta.value
    const selected = text.slice(start, end)

    let result: string
    let cursorPos: number

    if (action.type === 'wrap') {
      result = text.slice(0, start) + action.before + selected + action.after + text.slice(end)
      cursorPos = selected ? end + action.before.length + action.after.length : start + action.before.length
    } else {
      // line prefix — find start of current line
      const lineStart = text.lastIndexOf('\n', start - 1) + 1
      result = text.slice(0, lineStart) + action.prefix + text.slice(lineStart)
      cursorPos = start + action.prefix.length
    }

    onUpdate(result)

    // restore cursor after React re-render
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(cursorPos, cursorPos)
    })
  }

  return (
    <div style={{
      display: 'flex', gap: 2, padding: '6px 4px',
      borderBottom: `1px solid var(--journal-border)`,
      overflowX: 'auto',
    }}>
      {ACTIONS.map(a => (
        <button
          key={a.label}
          type="button"
          title={a.label}
          onClick={() => apply(a.action)}
          style={{
            width: 32, height: 32, borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none',
            color: 'var(--journal-muted)', cursor: 'pointer',
            flexShrink: 0,
          }}
          onMouseEnter={e => e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          <a.icon size={15} />
        </button>
      ))}
    </div>
  )
}
