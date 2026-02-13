import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AI 智能助手 - FPGA 技术咨询与 BOM 采购',
  description: '面向硬件工程团队的 AI 平台，支持技术问答、文档检索和 BOM 智能采购。',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  )
}
