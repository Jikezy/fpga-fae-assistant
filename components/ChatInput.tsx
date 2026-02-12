'use client'

import { useState, useRef, KeyboardEvent } from 'react'

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
    // 自动调整高度
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px'
  }

  return (
    <div className="max-w-4xl mx-auto px-2 py-2 sm:px-4 sm:py-4">
      <div className="flex gap-2 sm:gap-3 items-end bg-gradient-to-br from-white/95 to-gray-50/90 backdrop-blur-[60px] backdrop-saturate-[200%] rounded-2xl sm:rounded-3xl p-3 sm:p-4 border border-gray-200/60 shadow-[0_8px_32px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.8)] focus-within:border-purple-300 focus-within:shadow-[0_12px_40px_rgba(124,58,237,0.15)] transition-all">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="输入你的问题... (Shift+Enter换行)"
          disabled={disabled}
          rows={1}
          className="flex-1 bg-transparent resize-none outline-none text-gray-800 placeholder-gray-500 max-h-[200px] font-medium"
        />
        {isGenerating ? (
          <button
            onClick={onStop}
            className="p-2.5 bg-gradient-to-br from-red-400 to-red-600 text-white rounded-2xl hover:shadow-xl active:scale-95 transition-all flex-shrink-0 shadow-lg ring-1 ring-red-300"
            aria-label="停止生成"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" />
            </svg>
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={disabled || !input.trim()}
            className="p-2.5 bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-2xl hover:shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex-shrink-0 shadow-lg ring-1 ring-purple-300"
            aria-label="发送消息"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        )}
      </div>
      <p className="text-xs text-gray-600 mt-2 text-center">
        AI可能会出错，请核实重要信息
      </p>
    </div>
  )
}
