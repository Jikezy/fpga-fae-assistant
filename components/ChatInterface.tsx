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
}

export default function ChatInterface({ currentModel }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: '你好！我是FPGA FAE助手。我可以帮助你：\n\n- 📚 查询FPGA数据手册和技术文档\n- 💡 解答FPGA设计和应用问题\n- 🔧 提供技术方案和最佳实践建议\n- 🐛 协助调试和问题排查\n\n请随时向我提问！',
      timestamp: new Date(),
    },
  ])
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

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

    try {
      // 解析模型 ID 获取 provider 和 model
      // 格式: provider-modelName (例如: zhipu-glm-4-flash)
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
    }
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto">
        <MessageList messages={messages} isLoading={isLoading} />
        <div ref={messagesEndRef} />
      </div>

      {/* 输入框 */}
      <div className="border-t border-gray-200">
        <ChatInput onSend={handleSendMessage} disabled={isLoading} />
      </div>
    </div>
  )
}
