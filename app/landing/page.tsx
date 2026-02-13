'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import LiquidGlassBackground from '@/components/LiquidGlassBackground'

const features = [
  {
    title: '对话咨询',
    description: '像和资深 FAE 并肩作战一样，快速定位问题、给出可执行方案。',
    icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z',
  },
  {
    title: '文档检索',
    description: '上传技术文档后自动索引，提问即可返回定位到上下文的答案。',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  },
  {
    title: 'BOM 智能采购',
    description: '自动解析 BOM 并生成采购关键词，直达淘宝联盟推广链路。',
    icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z',
  },
  {
    title: '高速响应',
    description: '流式输出 + 规则预处理，兼顾解析精度与实时反馈速度。',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
  },
]

const processSteps = [
  { title: '上传文档/BOM', desc: '支持快速上传，自动完成结构识别。' },
  { title: 'AI 解析与检索', desc: '优先模型解析，异常时自动降级，结果持续可用。' },
  { title: '执行与转化', desc: '一键跳转采购或推广页面，缩短业务闭环。' },
]

export default function LandingPage() {
  const [typed, setTyped] = useState('')
  const fullText = '木叶作战模式已开启：告诉我你的技术问题，剩下的交给我。'

  useEffect(() => {
    let i = 0
    const timer = setInterval(() => {
      if (i >= fullText.length) {
        clearInterval(timer)
        return
      }
      setTyped(fullText.slice(0, i + 1))
      i += 1
    }, 26)

    return () => clearInterval(timer)
  }, [])

  return (
    <div className="relative min-h-screen overflow-hidden">
      <LiquidGlassBackground />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_20%,rgba(245,123,32,0.24),transparent_38%),radial-gradient(circle_at_88%_14%,rgba(187,35,45,0.2),transparent_34%),linear-gradient(160deg,rgba(255,247,230,0.82),rgba(255,236,206,0.7))]" />

      <div className="relative z-10">
        <section className="container mx-auto px-4 pb-14 pt-14 sm:pb-24 sm:pt-20">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65 }}
            className="mx-auto max-w-5xl text-center"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15, duration: 0.45 }}
              className="naruto-chip mb-6 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
            >
              <span className="h-2 w-2 animate-pulse rounded-full bg-orange-500" />
              木叶技术支援中心
            </motion.div>

            <h1 className="naruto-title mb-5 text-4xl font-black leading-tight text-orange-950 sm:text-6xl">
              木叶村 AI 工程助手
            </h1>
            <p className="mx-auto mb-8 max-w-3xl text-lg text-orange-900/85 sm:text-xl">
              咨询、检索、BOM 采购三线并行，像忍者小队协同一样把复杂工作拆解到可执行。
            </p>

            <div className="naruto-glass mx-auto mb-10 max-w-3xl rounded-3xl p-5 text-left sm:p-6">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-orange-700">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                实时战报
              </div>
              <p className="min-h-[56px] text-base leading-7 text-orange-950 sm:text-lg">
                {typed}
                <span className="ml-1 inline-block h-5 w-0.5 animate-pulse bg-orange-600 align-middle" />
              </p>
            </div>

            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/register"
                className="naruto-btn-primary rounded-2xl px-8 py-4 text-base font-bold transition-all"
              >
                立即开战（免费注册）
              </Link>
              <Link
                href="/login"
                className="rounded-2xl border border-orange-300/80 bg-white/75 px-8 py-4 text-base font-semibold text-orange-900 shadow-[0_8px_24px_rgba(171,64,17,0.12)] transition hover:-translate-y-0.5 hover:bg-white"
              >
                我已有账号
              </Link>
            </div>
          </motion.div>
        </section>

        <section className="container mx-auto px-4 py-8 sm:py-12">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            {features.map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08, duration: 0.45 }}
                className="naruto-glass rounded-3xl p-6"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 text-white shadow-lg">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                  </svg>
                </div>
                <h3 className="naruto-title mb-2 text-xl font-bold text-orange-950">{item.title}</h3>
                <p className="text-sm leading-7 text-orange-900/80">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="container mx-auto px-4 py-16 sm:py-20">
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="naruto-glass mx-auto max-w-5xl rounded-[2rem] p-6 sm:p-10"
          >
            <div className="mb-8 text-center">
              <h2 className="naruto-title mb-3 text-3xl font-black text-orange-950 sm:text-4xl">任务执行流程</h2>
              <p className="text-orange-900/80">从输入到转化，流程可视、可控、可追踪。</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {processSteps.map((step, index) => (
                <div key={step.title} className="rounded-2xl border border-orange-200/80 bg-white/70 p-5">
                  <p className="mb-2 text-sm font-bold uppercase tracking-wider text-orange-600">Step {index + 1}</p>
                  <h3 className="mb-2 text-lg font-bold text-orange-950">{step.title}</h3>
                  <p className="text-sm leading-7 text-orange-900/80">{step.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        <footer className="container mx-auto px-4 pb-12 pt-4">
          <div className="rounded-3xl border border-orange-200/70 bg-white/65 px-6 py-6 text-center text-sm text-orange-900/80 shadow-[0_8px_24px_rgba(171,64,17,0.12)] backdrop-blur-xl">
            <p className="font-semibold">© 2026 FPGA FAE 助手 · 火影联动主题版</p>
            <p className="mt-1">Powered by Claude / DeepSeek / PostgreSQL</p>
          </div>
        </footer>
      </div>
    </div>
  )
}
