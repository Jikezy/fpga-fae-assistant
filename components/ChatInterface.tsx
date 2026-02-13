'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import MessageList from './MessageList'
import ChatInput from './ChatInput'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface ChatInterfaceProps {
  fullReadRequest?: string | null
  onFullReadComplete?: () => void
}

export default function ChatInterface({ fullReadRequest, onFullReadComplete }: ChatInterfaceProps) {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const shouldAutoScrollRef = useRef(true)

  // 检查 AI 配置状态
  useEffect(() => {
    const checkConfig = async () => {
      try {
        const res = await fetch('/api/user/settings')
        if (res.ok) {
          const data = await res.json()
          setIsConfigured(!!data.hasApiKey && !!data.baseUrl && !!data.model)
        }
      } catch {
        setIsConfigured(false)
      }
    }
    checkConfig()
  }, [])

  // 检查是否接近底部
  const checkIfNearBottom = () => {
    const container = messagesContainerRef.current
    if (!container) return true

    const threshold = 150 // 距离底部150px内视为接近底部
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    return distanceFromBottom < threshold
  }

  // 处理用户手动滚动
  const handleScroll = () => {
    shouldAutoScrollRef.current = checkIfNearBottom()
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // 智能自动滚动：只有在用户位于底部时才滚动
  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      scrollToBottom()
    }
  }, [messages])

  // 处理完整阅读请求
  useEffect(() => {
    if (fullReadRequest) {
      handleFullRead(fullReadRequest)
      onFullReadComplete?.()
    }
  }, [fullReadRequest])

  // 停止生成
  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
      setIsLoading(false)
    }
  }

  const handleFullRead = async (filename: string) => {
    // 添加用户消息
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: `完整阅读：${filename}`,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)

    // 创建新的 AbortController
    abortControllerRef.current = new AbortController()

    try {
      const response = await fetch('/api/pdf/full-read-by-name', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename,
          question: '请详细分析这个PDF文档的内容，包括主要主题、关键信息和技术细节。',
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        // 尝试读取错误详情
        const errorData = await response.json().catch(() => null)
        if (errorData?.needsConfig) {
          throw new Error('AI 未配置，请前往设置页面配置 AI 服务')
        }
        const errorMessage = errorData?.message || errorData?.error || 'API请求失败'
        throw new Error(errorMessage)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let assistantMessage = ''
      let costEstimate = ''

      // 创建助手消息
      const assistantMessageId = (Date.now() + 1).toString()
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
        },
      ])

      // 流式读取响应
      while (reader) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)

              if (parsed.type === 'cost_estimate') {
                costEstimate = `费用预估：¥${parsed.totalCost}（约${parsed.estimatedPages}页）\n\n`
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessageId
                      ? { ...m, content: costEstimate }
                      : m
                  )
                )
              } else if (parsed.type === 'content') {
                assistantMessage += parsed.content
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessageId
                      ? { ...m, content: costEstimate + assistantMessage }
                      : m
                  )
                )
              } else if (parsed.type === 'error') {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessageId
                      ? { ...m, content: parsed.content }
                      : m
                  )
                )
              }
            } catch (e) {
              console.error('解析响应失败:', e)
            }
          }
        }
      }
    } catch (error) {
      console.error('完整阅读失败:', error)
      // 如果是用户主动中止，不显示错误消息
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('用户已停止生成')
        return
      }

      // 显示具体的错误信息
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `抱歉，完整阅读失败。\n\n错误详情：${errorMessage}\n\n如果提示 AI 未配置，请前往**设置页面**配置您的 AI 服务。`,
          timestamp: new Date(),
        },
      ])
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }

  const handleSendMessage = async (content: string) => {
    // 添加用户消息
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)

    // 创建新的 AbortController
    abortControllerRef.current = new AbortController()

    try {
      // 调用API（BYOK：只发 messages，后端从 DB 读用户配置）
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        // 尝试读取错误详情
        const errorData = await response.json().catch(() => null)
        if (errorData?.needsConfig) {
          throw new Error('AI 未配置，请前往设置页面配置 AI 服务')
        }
        const errorMessage = errorData?.message || errorData?.error || 'API请求失败'
        throw new Error(errorMessage)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let assistantMessage = ''

      // 创建助手消息
      const assistantMessageId = (Date.now() + 1).toString()
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
        },
      ])

      // 流式读取响应
      while (reader) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)
              if (parsed.content) {
                assistantMessage += parsed.content
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessageId
                      ? { ...m, content: assistantMessage }
                      : m
                  )
                )
              }
            } catch (e) {
              console.error('解析响应失败:', e)
            }
          }
        }
      }
    } catch (error) {
      console.error('发送消息失败:', error)
      // 如果是用户主动中止，不显示错误消息
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('用户已停止生成')
        return
      }

      // 显示具体的错误信息
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `抱歉，发生了错误。\n\n错误详情：${errorMessage}\n\n如果提示 AI 未配置，请前往**设置页面**配置您的 AI 服务（Base URL、API Key、模型名称）。`,
          timestamp: new Date(),
        },
      ])
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }

  const suggestions = [
    { text: 'FPGA 时序约束怎么写？', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    { text: 'Vivado 综合优化技巧', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
    { text: '帮我分析这段 Verilog 代码', icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4' },
    { text: 'DDR 接口设计要点', icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z' },
  ]

  return (
    <div className="flex flex-col h-full bg-transparent">
      {messages.length === 0 ? (
        /* 欢迎界面 */
        <div className="flex-1 flex items-center justify-center px-4 overflow-y-auto">
          <div className="text-center max-w-2xl mx-auto py-8">
            {/* Logo */}
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-[0_10px_28px_rgba(171,64,17,0.35)]">
              <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>

            <h2 className="text-2xl sm:text-3xl font-bold text-orange-950 mb-2">
              FPGA FAE 智能助手
            </h2>

            {isConfigured === null ? (
              <p className="text-orange-900/70 mb-8">正在检查配置...</p>
            ) : isConfigured ? (
              <>
                <p className="text-orange-900/70 mb-8">有什么我可以帮您的？试试下面的问题，或直接输入您的问题。</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => handleSendMessage(s.text)}
                      className="flex items-center gap-3 px-4 py-3 bg-gradient-to-br from-white/90 to-orange-50/80 backdrop-blur-[60px] border border-orange-200/70 rounded-2xl text-left text-sm text-orange-900/85 hover:border-orange-300 hover:shadow-[0_10px_30px_rgba(171,64,17,0.14)] transition-all group"
                    >
                      <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0 group-hover:bg-orange-100 transition-colors">
                        <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={s.icon} />
                        </svg>
                      </div>
                      <span className="font-medium">{s.text}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="text-orange-900/70 mb-6">请先配置 AI 服务后开始使用</p>
                <button
                  onClick={() => router.push('/settings')}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white font-semibold rounded-2xl shadow-[0_10px_30px_rgba(171,64,17,0.36)] hover:shadow-[0_14px_40px_rgba(171,64,17,0.44)] transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  前往配置
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        /* 消息列表 */
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto"
          onScroll={handleScroll}
        >
          <MessageList messages={messages} isLoading={isLoading} />
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* 输入框 */}
      <div className="border-t border-orange-200/50">
        <ChatInput
          onSend={handleSendMessage}
          disabled={isLoading}
          isGenerating={isLoading}
          onStop={handleStop}
        />
      </div>
    </div>
  )
}
