import { useMemo } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'

interface MathTextProps {
  text: string
  className?: string
}

/**
 * Renders plain text mixed with inline ($...$) and display ($$...$$) LaTeX math using KaTeX.
 * Falls back gracefully to plain text if no math delimiters are present.
 */
export function MathText({ text, className }: MathTextProps) {
  const parts = useMemo(() => {
    if (!text || !text.includes('$')) {
      return null
    }
    // Match $$...$$ (display) or $...$ (inline, non-greedy, not spanning empty)
    const regex = /(\$\$[\s\S]+?\$\$|\$(?:\\.|[^$\\])+\$)/g
    const segments: Array<{ type: 'text' | 'inline' | 'display'; content: string }> = []
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ type: 'text', content: text.slice(lastIndex, match.index) })
      }
      const raw = match[0]
      if (raw.startsWith('$$') && raw.endsWith('$$')) {
        segments.push({ type: 'display', content: raw.slice(2, -2) })
      } else {
        segments.push({ type: 'inline', content: raw.slice(1, -1) })
      }
      lastIndex = regex.lastIndex
    }

    if (lastIndex < text.length) {
      segments.push({ type: 'text', content: text.slice(lastIndex) })
    }

    return segments
  }, [text])

  if (!parts) {
    return <span className={className}>{text}</span>
  }

  return (
    <span className={className}>
      {parts.map((part, idx) => {
        if (part.type === 'text') {
          return <span key={idx}>{part.content}</span>
        }
        const html = katex.renderToString(part.content, {
          displayMode: part.type === 'display',
          throwOnError: false,
          strict: false,
        })
        return (
          <span
            key={idx}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )
      })}
    </span>
  )
}
