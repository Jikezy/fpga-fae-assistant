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
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
          )}

          <div
            className={`flex-1 max-w-3xl ${
              message.role === 'user'
                ? 'bg-gradient-to-br from-pink-500 to-purple-600 text-white rounded-3xl rounded-tr-md px-5 py-4 shadow-xl backdrop-blur-xl'
                : 'bg-white/20 backdrop-blur-xl rounded-3xl rounded-tl-md px-5 py-4 border border-white/30 shadow-xl'
            }`}
          >
            {message.role === 'user' ? (
              <p className="whitespace-pre-wrap font-medium">{message.content}</p>
            ) : (
              <div className="markdown-body prose prose-sm max-w-none text-white">
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
                            background: 'rgba(255, 255, 255, 0.15)',
                            backdropFilter: 'blur(10px)',
                            border: '1px solid rgba(255, 255, 255, 0.3)',
                            borderRadius: '1rem',
                            padding: '1rem',
                            fontSize: '0.875rem',
                          }}
                        >
                          {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                      ) : (
                        <code className="bg-white/20 text-white px-2 py-0.5 rounded-lg text-sm backdrop-blur-sm">
                          {children}
                        </code>
                      )
                    },
                    table({ children }: any) {
                      return (
                        <div className="overflow-x-auto my-4">
                          <table className="min-w-full border border-white/30 rounded-2xl overflow-hidden backdrop-blur-sm">
                            {children}
                          </table>
                        </div>
                      )
                    },
                    thead({ children }: any) {
                      return (
                        <thead className="bg-white/20 backdrop-blur-sm">
                          {children}
                        </thead>
                      )
                    },
                    th({ children }: any) {
                      return (
                        <th className="px-4 py-2 text-left text-sm font-semibold text-white border-b-2 border-white/30">
                          {children}
                        </th>
                      )
                    },
                    td({ children }: any) {
                      return (
                        <td className="px-4 py-2 text-sm text-white/90 border-b border-white/20">
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
            <p className="text-xs opacity-60 mt-2">
              {message.timestamp.toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>

          {message.role === 'user' && (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center flex-shrink-0 shadow-lg">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          )}
        </div>
      ))}

      {isLoading && (
        <div className="flex gap-4 justify-start">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div className="bg-white/20 backdrop-blur-xl rounded-3xl rounded-tl-md px-5 py-4 border border-white/30 shadow-xl">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
