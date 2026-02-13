'use client'

import { KeyboardEvent, useRef, useState } from 'react'

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
  isGenerating?: boolean
  onStop?: () => void
}

export default function ChatInput({ onSend, disabled, isGenerating, onStop }: ChatInputProps) {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = () => {
    if (input.trim() && !disabled) {
      onSend(input.trim())
      setInput('')
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`
  }

  return (
    <div className="mx-auto max-w-4xl px-2 py-2 sm:px-4 sm:py-4">
      <div className="naruto-glass flex items-end gap-2 rounded-2xl p-3 sm:gap-3 sm:rounded-3xl sm:p-4">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="输入你的问题...（Shift + Enter 换行）"
          disabled={disabled}
          rows={1}
          className="max-h-[200px] flex-1 resize-none bg-transparent font-medium text-orange-950 outline-none placeholder:text-orange-700/60"
        />

        {isGenerating ? (
          <button
            onClick={onStop}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-red-700 text-white shadow-lg ring-1 ring-red-300 transition hover:shadow-xl active:scale-95"
            aria-label="停止生成"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" />
            </svg>
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={disabled || !input.trim()}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 text-white shadow-lg ring-1 ring-orange-300 transition hover:shadow-xl active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="发送消息"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        )}
      </div>
      <p className="mt-2 text-center text-xs text-orange-900/75">AI 结果仅供参考，关键参数请二次确认。</p>
    </div>
  )
}
