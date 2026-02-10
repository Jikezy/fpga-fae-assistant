'use client'

import { useState, useRef, useEffect } from 'react'
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
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: '你好！我是FPGA FAE助手，可以帮你查询文档、解答技术问题。\n\n请先在设置页面配置 AI 服务后开始使用。',
      timestamp: new Date(),
    },
  ])
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const shouldAutoScrollRef = useRef(true)

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

  return (
    <div className="flex flex-col h-full bg-transparent">
      {/* 消息列表 */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto"
        onScroll={handleScroll}
      >
        <MessageList messages={messages} isLoading={isLoading} />
        <div ref={messagesEndRef} />
      </div>

      {/* 输入框 */}
      <div className="border-t border-white/10">
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
