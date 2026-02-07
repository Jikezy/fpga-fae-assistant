'use client'

import ModelSelector from './ModelSelector'

interface HeaderProps {
  onMenuClick: () => void
  currentModel: string
  onModelChange: (modelId: string) => void
}

export default function Header({ onMenuClick, currentModel, onModelChange }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Toggle menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-gray-800">FPGA FAE助手</h1>
      </div>

      <div className="flex items-center gap-4">
        <ModelSelector currentModel={currentModel} onModelChange={onModelChange} />
      </div>
    </header>
  )
}
