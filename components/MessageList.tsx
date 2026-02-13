'use client'

import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import remarkGfm from 'remark-gfm'
import { Message } from './ChatInterface'

interface MessageListProps {
  messages: Message[]
  isLoading: boolean
}

export default function MessageList({ messages, isLoading }: MessageListProps) {
  return (
    <div className="mx-auto max-w-4xl space-y-4 px-2 py-4 sm:space-y-6 sm:px-4 sm:py-8">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex gap-2 sm:gap-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          {message.role === 'assistant' && (
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-red-600 text-white shadow-lg ring-2 ring-orange-200 sm:h-8 sm:w-8">
              <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
          )}

          <div
            className={`flex-1 max-w-3xl rounded-3xl px-3 py-3 shadow-[0_10px_24px_rgba(171,64,17,0.12)] sm:px-5 sm:py-4 ${
              message.role === 'user'
                ? 'rounded-tr-md border border-orange-200/70 bg-gradient-to-br from-orange-50/95 to-amber-100/85 text-orange-950'
                : 'naruto-glass rounded-tl-md'
            }`}
          >
            {message.role === 'user' ? (
              <p className="whitespace-pre-wrap font-medium text-orange-950">{message.content}</p>
            ) : (
              <div className="markdown-body prose prose-sm max-w-none text-orange-950">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ className, children }: any) {
                      const match = /language-(\w+)/.exec(className || '')
                      const isInline = !match
                      return !isInline ? (
                        <SyntaxHighlighter
                          style={oneLight as any}
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
                        <code className="rounded-lg border border-orange-300 bg-orange-100 px-2 py-0.5 text-sm text-orange-900">
                          {children}
                        </code>
                      )
                    },
                    table({ children }: any) {
                      return (
                        <div className="my-4 overflow-x-auto">
                          <table className="min-w-full overflow-hidden rounded-2xl border border-orange-200 bg-white/90">
                            {children}
                          </table>
                        </div>
                      )
                    },
                    thead({ children }: any) {
                      return <thead className="bg-orange-100">{children}</thead>
                    },
                    th({ children }: any) {
                      return (
                        <th className="border-b-2 border-orange-300 px-4 py-2 text-left text-sm font-semibold text-orange-900">
                          {children}
                        </th>
                      )
                    },
                    td({ children }: any) {
                      return (
                        <td className="border-b border-orange-200 px-4 py-2 text-sm text-orange-900/85">
                          {children}
                        </td>
                      )
                    },
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            )}

            <p className="mt-2 text-xs font-medium text-orange-800/70">
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
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-red-600 text-white shadow-lg ring-2 ring-orange-200 sm:h-8 sm:w-8">
            <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div className="naruto-glass rounded-3xl rounded-tl-md px-3 py-3 sm:px-5 sm:py-4">
            <div className="flex gap-1">
              <span className="h-2 w-2 animate-bounce rounded-full bg-orange-500" style={{ animationDelay: '0ms' }} />
              <span className="h-2 w-2 animate-bounce rounded-full bg-orange-500" style={{ animationDelay: '150ms' }} />
              <span className="h-2 w-2 animate-bounce rounded-full bg-red-500" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
