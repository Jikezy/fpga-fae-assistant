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
  currentModel: string
  fullReadRequest?: string | null
  onFullReadComplete?: () => void
}

export default function ChatInterface({ currentModel, fullReadRequest, onFullReadComplete }: ChatInterfaceProps) {
  // 获取模型友好名称
  const getModelDisplayName = (modelId: string) => {
    if (modelId === 'anthropic-claude-opus-4-6') return 'Claude Opus 4.6'
    return modelId
  }

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `你好！我是FPGA FAE助手，可以帮你查询文档、解答技术问题。\n\n📌 当前模型：**${getModelDisplayName(currentModel)}**`,
      timestamp: new Date(),
    },
  ])
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const shouldAutoScrollRef = useRef(true)

  // 当模型切换时更新欢迎消息
  useEffect(() => {
    setMessages([
      {
        id: '1',
        role: 'assistant',
        content: `你好！我是FPGA FAE助手，可以帮你查询文档、解答技术问题。\n\n📌 当前模型：**${getModelDisplayName(currentModel)}**`,
        timestamp: new Date(),
      },
    ])
  }, [currentModel])

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
      content: `📄 完整阅读：${filename}`,
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
        throw new Error('API请求失败')
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
                costEstimate = `💰 费用预估：¥${parsed.totalCost}（约${parsed.estimatedPages}页）\n\n`
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
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '抱歉，完整阅读失败。请检查网络连接或稍后重试。',
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
      // 解析模型 ID 获取 provider 和 model
      // 格式: provider-modelName (例如: anthropic-claude-opus-4-6)
      const [provider, ...modelParts] = currentModel.split('-')
      const modelName = modelParts.join('-')

      // 调用API
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
          provider,
          model: modelName,
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        throw new Error('API请求失败')
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
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '抱歉，发生了错误。请检查API配置或稍后重试。',
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
