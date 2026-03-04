'use client'

import { useState, useEffect, useRef, type CSSProperties } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import remarkGfm from 'remark-gfm'
import { Message } from './ChatInterface'

interface MessageListProps {
  messages: Message[]
  isLoading: boolean
}

const syntaxStyle = oneLight as Record<string, CSSProperties>

const markdownComponents: Components = {
  code({ className, children }) {
    const match = /language-(\w+)/.exec(className || '')
    const isInline = !match
    return !isInline ? (
      <SyntaxHighlighter
        style={syntaxStyle}
        language={match[1]}
        PreTag="div"
        customStyle={{
          background: 'rgba(255, 250, 240, 0.95)',
          border: '1px solid rgba(251, 191, 36, 0.45)',
          borderRadius: '1rem',
          padding: '1rem',
          fontSize: '0.875rem',
        }}
      >
        {String(children).replace(/\n$/, '')}
      </SyntaxHighlighter>
    ) : (
      <code className="rounded-lg border border-violet-200 bg-violet-100/80 px-2 py-0.5 text-sm text-violet-800">
        {children}
      </code>
    )
  },
  table({ children }) {
    return (
      <div className="my-4 overflow-x-auto">
        <table className="min-w-full overflow-hidden rounded-2xl border border-slate-200 bg-white/95">
          {children}
        </table>
      </div>
    )
  },
  thead({ children }) {
    return <thead className="bg-violet-100/70">{children}</thead>
  },
  th({ children }) {
    return (
      <th className="border-b-2 border-violet-200 px-4 py-2 text-left text-sm font-semibold text-slate-800">
        {children}
      </th>
    )
  },
  td({ children }) {
    return (
      <td className="border-b border-slate-200 px-4 py-2 text-sm text-slate-700">
        {children}
      </td>
    )
  },
}

export default function MessageList({ messages, isLoading }: MessageListProps) {
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (isLoading) {
      setElapsed(0)
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000)
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      setElapsed(0)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isLoading])

  const thinkingLabel =
    elapsed < 5 ? '思考中' :
    elapsed < 15 ? '正在生成回答' :
    elapsed < 30 ? '内容较长，请稍候' :
    elapsed < 60 ? '模型响应较慢，请耐心等待' :
    '仍在等待模型响应…'
  return (
    <div className="mx-auto max-w-4xl space-y-4 px-2 py-4 sm:space-y-6 sm:px-4 sm:py-8">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex gap-2 sm:gap-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          {message.role === 'assistant' && (
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg ring-2 ring-violet-200 sm:h-8 sm:w-8">
              <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
          )}

          <div
              className={`flex-1 max-w-3xl rounded-3xl px-3 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.1)] sm:px-5 sm:py-4 ${
                message.role === 'user'
                  ? 'rounded-tr-md border border-slate-200 bg-gradient-to-br from-slate-100 to-slate-200 text-slate-900'
                  : 'naruto-glass rounded-tl-md'
              }`}
            >
            {message.role === 'user' ? (
              <p className="whitespace-pre-wrap font-medium text-slate-900">{message.content}</p>
            ) : (
              <div className="markdown-body prose prose-sm max-w-none text-slate-800">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={markdownComponents}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            )}

            <p className="mt-2 text-xs font-medium text-slate-500">
              {message.timestamp.toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>

          {message.role === 'user' && (
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-500 to-slate-700 text-white shadow-lg ring-2 ring-slate-300 sm:h-8 sm:w-8">
              <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          )}
        </div>
      ))}

      {isLoading && (
        <div className="flex justify-start gap-2 sm:gap-4">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg ring-2 ring-violet-200 sm:h-8 sm:w-8">
            <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div className="naruto-glass rounded-3xl rounded-tl-md px-4 py-3 sm:px-5 sm:py-4">
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-violet-500" style={{ animationDelay: '0ms' }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-violet-500" style={{ animationDelay: '150ms' }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-500" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-xs text-slate-500">
                {thinkingLabel}
                {elapsed > 0 && (
                  <span className="ml-1 tabular-nums text-violet-500/80">{elapsed}s</span>
                )}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
