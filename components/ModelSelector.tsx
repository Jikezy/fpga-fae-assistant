'use client'

import { useState } from 'react'

export interface ModelOption {
  id: string
  name: string
  provider: 'anthropic' | 'siliconflow'
  description: string
  isFree: boolean
}

const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: 'siliconflow-deepseek-ai/DeepSeek-V3',
    name: 'DeepSeek V3',
    provider: 'siliconflow',
    description: '免费 · 强大的通用模型，适合日常使用',
    isFree: true,
  },
  {
    id: 'siliconflow-Qwen/Qwen2.5-72B-Instruct',
    name: 'Qwen 2.5 72B',
    provider: 'siliconflow',
    description: '免费 · 通义千问大模型，中文能力出色',
    isFree: true,
  },
  {
    id: 'anthropic-claude-opus-4-6',
    name: 'Claude Opus 4.6 ⭐',
    provider: 'anthropic',
    description: '需 API Key · 顶级智能，最强推理能力',
    isFree: false,
  },
]

interface ModelSelectorProps {
  currentModel: string
  onModelChange: (modelId: string) => void
}

export default function ModelSelector({ currentModel, onModelChange }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)

  const selectedModel = AVAILABLE_MODELS.find((m) => m.id === currentModel) || AVAILABLE_MODELS[0]
  const freeModels = AVAILABLE_MODELS.filter((m) => m.isFree)
  const paidModels = AVAILABLE_MODELS.filter((m) => !m.isFree)

  const renderModelButton = (model: ModelOption) => (
    <button
      key={model.id}
      onClick={() => {
        onModelChange(model.id)
        setIsOpen(false)
      }}
      className={`w-full text-left px-3 py-3 rounded-lg transition-colors ${
        model.id === currentModel
          ? 'bg-blue-50 border border-blue-200'
          : 'hover:bg-gray-50'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900">{model.name}</span>
            {model.isFree && (
              <span className="px-2 py-0.5 text-xs font-medium text-green-700 bg-green-100 rounded-full">
                免费
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500 mt-1">{model.description}</div>
        </div>
        {model.id === currentModel && (
          <svg className="w-5 h-5 text-blue-600 flex-shrink-0 ml-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        )}
      </div>
    </button>
  )

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
        </svg>
        <div className="text-left">
          <div className="text-sm font-medium text-gray-900">{selectedModel.name}</div>
          <div className="text-xs text-gray-500 hidden sm:block">{selectedModel.description}</div>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-96 overflow-y-auto">
            <div className="p-2">
              <div className="px-3 py-2 text-xs font-semibold text-green-600 uppercase">
                免费模型
              </div>
              {freeModels.map(renderModelButton)}
              <div className="px-3 py-2 mt-2 text-xs font-semibold text-gray-500 uppercase border-t border-gray-100 pt-3">
                高级模型
              </div>
              {paidModels.map(renderModelButton)}
            </div>
            <div className="border-t border-gray-200 p-3 bg-gray-50">
              <p className="text-xs text-gray-600">
                免费模型无需配置，注册即可使用
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
