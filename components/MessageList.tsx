'use client'

import { Message } from './ChatInterface'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface MessageListProps {
  messages: Message[]
  isLoading: boolean
}

export default function MessageList({ messages, isLoading }: MessageListProps) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex gap-4 ${
            message.role === 'user' ? 'justify-end' : 'justify-start'
          }`}
        >
          {message.role === 'assistant' && (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-lg ring-2 ring-blue-200">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
          )}

          <div
            className={`flex-1 max-w-3xl ${
              message.role === 'user'
                ? 'bg-gradient-to-br from-blue-50/95 to-blue-100/90 backdrop-blur-[60px] backdrop-saturate-[200%] border border-blue-200/60 text-gray-800 rounded-3xl rounded-tr-md px-5 py-4 shadow-[0_8px_32px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.8)]'
                : 'bg-gradient-to-br from-white/95 to-gray-50/90 backdrop-blur-[60px] backdrop-saturate-[200%] rounded-3xl rounded-tl-md px-5 py-4 border border-gray-200/60 shadow-[0_8px_32px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.8)]'
            }`}
          >
            {message.role === 'user' ? (
              <p className="whitespace-pre-wrap font-medium text-gray-800">{message.content}</p>
            ) : (
              <div className="markdown-body prose prose-sm max-w-none text-gray-800">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ node, className, children, ...props }: any) {
                      const match = /language-(\w+)/.exec(className || '')
                      const isInline = !match
                      return !isInline ? (
                        <SyntaxHighlighter
                          style={oneLight as any}
                          language={match[1]}
                          PreTag="div"
                          customStyle={{
                            background: 'rgba(248, 250, 252, 0.95)',
                            backdropFilter: 'blur(20px)',
                            border: '1px solid rgba(226, 232, 240, 0.8)',
                            borderRadius: '1rem',
                            padding: '1rem',
                            fontSize: '0.875rem',
                          }}
                        >
                          {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                      ) : (
                        <code className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded-lg text-sm border border-gray-300">
                          {children}
                        </code>
                      )
                    },
                    table({ children }: any) {
                      return (
                        <div className="overflow-x-auto my-4">
                          <table className="min-w-full border border-gray-300 rounded-2xl overflow-hidden bg-white/90 backdrop-blur-sm">
                            {children}
                          </table>
                        </div>
                      )
                    },
                    thead({ children }: any) {
                      return (
                        <thead className="bg-gray-100 backdrop-blur-sm">
                          {children}
                        </thead>
                      )
                    },
                    th({ children }: any) {
                      return (
                        <th className="px-4 py-2 text-left text-sm font-semibold text-gray-800 border-b-2 border-gray-300">
                          {children}
                        </th>
                      )
                    },
                    td({ children }: any) {
                      return (
                        <td className="px-4 py-2 text-sm text-gray-700 border-b border-gray-200">
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
            <p className="text-xs text-white/80 mt-2 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
              {message.timestamp.toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>

          {message.role === 'user' && (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center flex-shrink-0 shadow-lg ring-2 ring-white/50">
              <svg className="w-5 h-5 text-white drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          )}
        </div>
      ))}

      {isLoading && (
        <div className="flex gap-4 justify-start">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center flex-shrink-0 shadow-lg ring-2 ring-white/50">
            <svg className="w-5 h-5 text-white drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div className="bg-gradient-to-br from-white/15 to-white/8 backdrop-blur-[40px] backdrop-saturate-[180%] rounded-3xl rounded-tl-md px-5 py-4 border border-white/25 shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.4)]">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
