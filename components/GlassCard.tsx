'use client'

import { ReactNode, useState } from 'react'
import { motion } from 'framer-motion'

interface GlassCardProps {
  children: ReactNode
  className?: string
  hover?: boolean
  onClick?: () => void
}

export default function GlassCard({ children, className = '', hover = true, onClick }: GlassCardProps) {
  const [ripples, setRipples] = useState<Array<{ x: number; y: number; id: number }>>([])

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!hover) return

    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100

    const newRipple = { x, y, id: Date.now() }
    setRipples((prev) => [...prev, newRipple])

    // Remove ripple after animation
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== newRipple.id))
    }, 600)
  }

  return (
    <motion.div
      className={`
        relative overflow-hidden
        bg-gradient-to-br from-white/15 to-white/8
        backdrop-blur-[40px] backdrop-saturate-[180%]
        border border-white/25
        rounded-3xl
        shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.4)]
        ${hover ? 'transition-all duration-300 hover:shadow-[0_16px_48px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.5)] hover:scale-[1.02]' : ''}
        ${className}
      `}
      onMouseDown={handleMouseDown}
      onClick={onClick}
      whileHover={hover ? { scale: 1.02 } : {}}
      whileTap={hover ? { scale: 0.98 } : {}}
    >
      {/* Liquid ripple effects */}
      {ripples.map((ripple) => (
        <motion.div
          key={ripple.id}
          className="absolute pointer-events-none"
          style={{
            left: `${ripple.x}%`,
            top: `${ripple.y}%`,
            width: '0px',
            height: '0px',
          }}
          initial={{ scale: 0, opacity: 0.8 }}
          animate={{ scale: 100, opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              width: '10px',
              height: '10px',
              background: 'radial-gradient(circle, rgba(34,211,238,0.6) 0%, transparent 70%)',
              boxShadow: '0 0 20px rgba(34,211,238,0.4)',
            }}
          />
        </motion.div>
      ))}

      {/* Rainbow edge glow on hover */}
      {hover && (
        <motion.div
          className="absolute inset-0 rounded-3xl pointer-events-none"
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(236,72,153,0.3), rgba(34,211,238,0.3))',
            filter: 'blur(20px)',
            transform: 'scale(1.05)',
          }}
        />
      )}

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </motion.div>
  )
}
