'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'

const featureCards = [
  {
    title: '上下文对话',
    description: '支持多轮上下文记忆与任务跟进，让团队沟通与执行保持连续。',
  },
  {
    title: '流式响应',
    description: '首 token 快速返回，答案边生成边展示，显著降低等待感知。',
  },
  {
    title: '文档检索增强',
    description: '对接知识库后可直接引用业务资料，回答可追溯、可复核。',
  },
  {
    title: '可扩展工具链',
    description: '通过 API 与常用系统联动，覆盖问答、分析、采购与协作流程。',
  },
]

const integrations = [
  'OpenAI',
  'Anthropic',
  'DeepSeek',
  'PostgreSQL',
  'Pinecone',
  'Slack',
  'Zapier',
  'Notion',
]

const previewMessages = [
  {
    role: 'user',
    text: '请把这份 BOM 风险项整理成可执行清单。',
    time: '09:41',
  },
  {
    role: 'assistant',
    text: '已收到。我会按缺货风险、替代建议、价格波动三部分输出。',
    time: '09:41',
  },
]

const previewTarget =
  '初步分析完成：共识别 7 个高风险料号，已附可替代型号与优先处理顺序。'
const streamTarget =
  '> stream.start(session="alpha")\n索引知识库：3/3\n生成中：已完成风险摘要，正在补充行动建议...'

export default function LandingPage() {
  const [previewTyped, setPreviewTyped] = useState('')
  const [streamTyped, setStreamTyped] = useState('')

  useEffect(() => {
    let index = 0
    const timer = setInterval(() => {
      if (index >= previewTarget.length) {
        clearInterval(timer)
        return
      }
      setPreviewTyped(previewTarget.slice(0, index + 1))
      index += 1
    }, 24)

    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    let index = 0
    const timer = setInterval(() => {
      if (index >= streamTarget.length) {
        clearInterval(timer)
        return
      }
      setStreamTyped(streamTarget.slice(0, index + 1))
      index += 1
    }, 18)

    return () => clearInterval(timer)
  }, [])

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-100 text-slate-900">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_84%_4%,rgba(139,92,246,0.14),transparent_32%),radial-gradient(circle_at_8%_14%,rgba(148,163,184,0.2),transparent_30%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_45%,#f8fafc_100%)]" />

      <div className="relative z-10">
        <section className="container mx-auto px-4 pb-12 pt-14 sm:pb-18 sm:pt-20">
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="grid items-center gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10"
          >
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-violet-200/80 bg-violet-100/70 px-4 py-2 text-sm font-semibold text-violet-700">
                <span className="h-2 w-2 animate-pulse rounded-full bg-violet-500" />
                AI Chat Platform
              </span>

              <h1 className="mt-5 text-4xl font-black leading-tight text-slate-950 sm:text-5xl lg:text-6xl">
                极简而专业的
                <br />
                AI 对话平台首页
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
                面向真实业务场景构建，融合对话协作、流式生成与工具集成。
                用中性色界面与紫色 AI 强调色，传达更正式、可信的产品气质。
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center rounded-2xl bg-violet-600 px-8 py-4 text-base font-bold text-white shadow-[0_12px_32px_rgba(124,58,237,0.35)] transition hover:-translate-y-0.5 hover:bg-violet-500"
                >
                  Try Now
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white/85 px-8 py-4 text-base font-semibold text-slate-700 shadow-sm transition hover:border-violet-200 hover:text-violet-700"
                >
                  登录控制台
                </Link>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white/90 p-4 shadow-[0_18px_46px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:p-6">
              <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-4">
                <p className="text-sm font-semibold text-slate-700">Conversational UI Preview</p>
                <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                  Live
                </span>
              </div>

              <div className="space-y-3">
                {previewMessages.map((message) => (
                  <div
                    key={`${message.role}-${message.time}`}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-7 ${
                        message.role === 'user'
                          ? 'rounded-br-md bg-slate-900 text-white'
                          : 'rounded-bl-md border border-violet-100 bg-violet-50/80 text-slate-700'
                      }`}
                    >
                      <p>{message.text}</p>
                      <p
                        className={`mt-1 text-[11px] ${
                          message.role === 'user' ? 'text-slate-300' : 'text-slate-500'
                        }`}
                      >
                        {message.time}
                      </p>
                    </div>
                  </div>
                ))}

                <div className="flex justify-start">
                  <div className="max-w-[88%] rounded-2xl rounded-bl-md border border-violet-200 bg-white px-4 py-3 text-sm leading-7 text-slate-700">
                    <p>
                      {previewTyped}
                      <span className="ml-1 inline-block h-4 w-0.5 animate-pulse bg-violet-500 align-middle" />
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">09:42</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        <section className="container mx-auto px-4 py-10 sm:py-12">
          <div className="mb-6 text-center">
            <h2 className="text-3xl font-black text-slate-950 sm:text-4xl">AI 能力模块</h2>
            <p className="mt-2 text-slate-600">围绕企业落地场景设计的核心能力组合</p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {featureCards.map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.06, duration: 0.4 }}
                className="rounded-3xl border border-slate-200 bg-white/85 p-6 shadow-sm"
              >
                <div className="mb-4 h-2.5 w-10 rounded-full bg-violet-500/90" />
                <h3 className="text-lg font-bold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="container mx-auto px-4 py-12 sm:py-14">
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-[1.75rem] border border-slate-200 bg-slate-950 p-6 text-slate-100 shadow-[0_14px_42px_rgba(15,23,42,0.35)]">
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-violet-300">
                Streaming Demo
              </p>
              <pre className="mt-4 min-h-[150px] whitespace-pre-wrap rounded-2xl border border-slate-700/80 bg-slate-900/75 p-4 font-mono text-sm leading-7 text-slate-200">
                {streamTyped}
                <span className="ml-1 inline-block h-4 w-0.5 animate-pulse bg-violet-400 align-middle" />
              </pre>
            </div>

            <div className="rounded-[1.75rem] border border-slate-200 bg-white/90 p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-violet-700">
                Integrations
              </p>
              <h3 className="mt-3 text-2xl font-black text-slate-950">现有系统可快速接入</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                无需重构现有流程，通过标准接口快速对接 AI 能力，减少迁移成本。
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                {integrations.map((item) => (
                  <span
                    key={item}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 pb-12 pt-4 sm:pb-16">
          <div className="rounded-[2rem] border border-violet-200/70 bg-gradient-to-r from-violet-600 to-violet-500 px-6 py-8 text-center text-white shadow-[0_16px_36px_rgba(124,58,237,0.35)] sm:px-10">
            <h2 className="text-3xl font-black sm:text-4xl">准备好开始了吗？</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-violet-100 sm:text-base">
              现在就体验更专业的 AI 对话工作流，用统一界面连接问答、检索与业务执行。
            </p>
            <Link
              href="/register"
              className="mt-6 inline-flex items-center justify-center rounded-2xl bg-white px-9 py-3.5 text-base font-black text-violet-700 transition hover:-translate-y-0.5 hover:bg-violet-50"
            >
              Try Now
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
