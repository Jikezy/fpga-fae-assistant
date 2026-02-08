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
    <div className="max-w-4xl mx-auto px-4 py-4">
      <div className="flex gap-3 items-end bg-white/20 backdrop-blur-xl rounded-3xl p-4 border border-white/30 shadow-2xl focus-within:border-white/60 transition-all">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="输入你的问题... (Shift+Enter换行)"
          disabled={disabled}
          rows={1}
          className="flex-1 bg-transparent resize-none outline-none text-white placeholder-white/50 max-h-[200px] font-medium"
        />
        {isGenerating ? (
          <button
            onClick={onStop}
            className="p-2.5 bg-gradient-to-br from-red-500 to-pink-600 text-white rounded-2xl hover:shadow-xl transition-all flex-shrink-0 shadow-lg"
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
            className="p-2.5 bg-gradient-to-br from-cyan-500 to-blue-600 text-white rounded-2xl hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all flex-shrink-0 shadow-lg"
            aria-label="发送消息"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        )}
      </div>
      <p className="text-xs text-white/60 mt-2 text-center">
        AI可能会出错，请核实重要信息
      </p>
    </div>
  )
}
