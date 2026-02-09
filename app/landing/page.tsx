'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import LiquidGlassBackground from '@/components/LiquidGlassBackground'

export default function LandingPage() {
  const [streamedText, setStreamedText] = useState('')
  const fullText = "Hello! I'm your AI assistant. How can I help you design, build, and deploy intelligent applications today?"

  // 流式文本动画
  useEffect(() => {
    let index = 0
    const interval = setInterval(() => {
      if (index < fullText.length) {
        setStreamedText(fullText.substring(0, index + 1))
        index++
      } else {
        clearInterval(interval)
      }
    }, 30)
    return () => clearInterval(interval)
  }, [])

  const features = [
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      ),
      title: '自然对话',
      description: '基于 Claude Opus 4 的自然语言理解，支持上下文记忆和多轮对话'
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      title: '文档检索',
      description: 'RAG 技术，上传 PDF 文档，AI 自动提取关键信息并精准回答问题'
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
        </svg>
      ),
      title: 'BOM 智能采购',
      description: '输入元器件清单，AI 自动解析并在淘宝搜索最优价格，一键生成采购方案'
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      title: '实时流式',
      description: '流式响应技术，内容逐字输出，提供流畅的交互体验，降低等待时间'
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
      ),
      title: '个性化配置',
      description: '支持用户自定义 API Key，灵活配置模型参数，满足不同场景需求'
    }
  ]

  const integrations = [
    { name: 'Anthropic Claude', logo: '🤖' },
    { name: 'PostgreSQL', logo: '🐘' },
    { name: 'Next.js', logo: '▲' },
    { name: 'Vercel', logo: '▼' },
    { name: 'Neon', logo: '⚡' },
    { name: 'Tailwind', logo: '🎨' }
  ]

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* 3D Liquid Glass Background */}
      <LiquidGlassBackground />

      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-100/15 via-transparent to-purple-100/20 z-0" />

      {/* Main Content */}
      <div className="relative z-10">
        {/* Hero Section */}
        <section className="container mx-auto px-4 pt-12 pb-16 sm:pt-20 sm:pb-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-4xl mx-auto"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500/20 to-purple-600/20 backdrop-blur-[60px] border border-purple-400/30 rounded-full mb-6"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
              </span>
              <span className="text-sm font-medium text-gray-800">Powered by Claude Opus 4</span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="text-4xl sm:text-5xl md:text-7xl font-bold text-gray-900 mb-6 leading-tight"
            >
              FPGA 技术专家
              <br />
              <span className="bg-gradient-to-r from-purple-600 to-purple-400 bg-clip-text text-transparent">
                AI 智能助手
              </span>
              <br />
              <span className="text-2xl sm:text-3xl md:text-4xl bg-gradient-to-r from-orange-500 to-orange-400 bg-clip-text text-transparent">
                + BOM 智能采购
              </span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="text-lg sm:text-xl md:text-2xl text-gray-600 mb-12 max-w-2xl mx-auto"
            >
              基于 Claude AI + RAG 技术，提供专业的 FPGA 技术咨询与电子元器件智能采购服务
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            >
              <Link href="/register">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-8 py-4 bg-gradient-to-r from-purple-600 to-purple-500 text-white text-lg font-semibold rounded-2xl shadow-[0_8px_30px_rgba(124,58,237,0.4)] hover:shadow-[0_12px_40px_rgba(124,58,237,0.5)] transition-all"
                >
                  立即试用 →
                </motion.button>
              </Link>
              <Link href="/login">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-8 py-4 bg-white/80 backdrop-blur-[60px] text-gray-800 text-lg font-semibold rounded-2xl border border-gray-300 hover:border-purple-400 hover:bg-white/90 transition-all shadow-lg"
                >
                  登录账号
                </motion.button>
              </Link>
              <Link href="/bom">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-8 py-4 bg-gradient-to-r from-orange-500 to-orange-400 text-white text-lg font-semibold rounded-2xl shadow-[0_8px_30px_rgba(249,115,22,0.4)] hover:shadow-[0_12px_40px_rgba(249,115,22,0.5)] transition-all"
                >
                  BOM 采购 →
                </motion.button>
              </Link>
            </motion.div>
          </motion.div>

          {/* Conversational UI Preview */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.8 }}
            className="mt-20 max-w-3xl mx-auto"
          >
            <div className="bg-gradient-to-br from-white/95 to-gray-50/90 backdrop-blur-[60px] backdrop-saturate-[200%] rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] border border-gray-200/60 p-4 sm:p-8">
              {/* User Message */}
              <div className="flex justify-end mb-4">
                <div className="bg-gradient-to-br from-purple-100 to-purple-50 px-6 py-4 rounded-2xl rounded-tr-md max-w-md">
                  <p className="text-gray-800 font-medium">请帮我分析 FPGA 时序优化方案</p>
                </div>
              </div>

              {/* AI Response with Streaming Animation */}
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div className="flex-1 bg-white/90 backdrop-blur-sm px-6 py-4 rounded-2xl rounded-tl-md border border-gray-200">
                  <p className="text-gray-800 leading-relaxed">
                    {streamedText}
                    <span className="inline-block w-0.5 h-5 bg-purple-500 ml-1 animate-pulse"></span>
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Features Section */}
        <section className="container mx-auto px-4 py-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              强大的 AI 能力
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              集成最先进的 AI 技术，为您提供智能、高效的技术支持
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                whileHover={{ y: -8, transition: { duration: 0.2 } }}
                className="bg-gradient-to-br from-white/95 to-gray-50/90 backdrop-blur-[60px] backdrop-saturate-[200%] rounded-3xl p-5 sm:p-8 border border-gray-200/60 shadow-[0_8px_32px_rgba(0,0,0,0.1)] hover:shadow-[0_12px_40px_rgba(124,58,237,0.15)] hover:border-purple-300 transition-all"
              >
                <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Integrations Section */}
        <section className="container mx-auto px-4 py-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              技术栈集成
            </h2>
            <p className="text-lg text-gray-600">
              基于业界领先的技术和服务构建
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="flex flex-wrap justify-center items-center gap-8 max-w-4xl mx-auto"
          >
            {integrations.map((integration, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
                whileHover={{ scale: 1.1 }}
                className="bg-white/90 backdrop-blur-[60px] px-6 py-4 rounded-2xl border border-gray-200 shadow-lg hover:shadow-xl hover:border-purple-300 transition-all"
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{integration.logo}</span>
                  <span className="text-sm font-semibold text-gray-800">{integration.name}</span>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* Final CTA Section */}
        <section className="container mx-auto px-4 py-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl mx-auto"
          >
            <div className="bg-gradient-to-br from-purple-600 to-purple-500 rounded-3xl p-6 sm:p-12 md:p-16 text-center shadow-[0_20px_60px_rgba(124,58,237,0.3)] relative overflow-hidden">
              {/* Decorative Elements */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-700/20 rounded-full blur-3xl"></div>

              <div className="relative z-10">
                <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                  准备好开始了吗？
                </h2>
                <p className="text-xl text-purple-100 mb-10 max-w-2xl mx-auto">
                  立即注册，体验 AI 驱动的 FPGA 技术咨询服务
                </p>
                <Link href="/register">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-10 py-5 bg-white text-purple-600 text-lg font-bold rounded-2xl shadow-[0_8px_30px_rgba(255,255,255,0.3)] hover:shadow-[0_12px_40px_rgba(255,255,255,0.4)] transition-all"
                  >
                    免费注册 →
                  </motion.button>
                </Link>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Footer */}
        <footer className="container mx-auto px-4 py-12 border-t border-gray-200/50">
          <div className="text-center text-gray-600">
            <p className="mb-2">© 2026 FPGA FAE助手. All rights reserved.</p>
            <p className="text-sm">Powered by Claude Opus 4 × Neon PostgreSQL</p>
          </div>
        </footer>
      </div>
    </div>
  )
}
