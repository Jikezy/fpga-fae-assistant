import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AI 智能助手 - FPGA技术咨询 & BOM智能采购',
  description: '基于Claude AI的智能助手平台，提供FPGA技术咨询和电子元器件BOM智能采购服务',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className="font-sans">{children}</body>
    </html>
  )
}
