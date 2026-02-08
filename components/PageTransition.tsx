'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { ReactNode } from 'react'

interface PageTransitionProps {
  children: ReactNode
  transitionKey: string
}

export default function PageTransition({ children, transitionKey }: PageTransitionProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={transitionKey}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{
          duration: 0.5,
          ease: [0.645, 0.045, 0.355, 1.0], // Cubic bezier for smooth easing
        }}
        className="w-full h-full"
      >
        {/* Liquid morphing overlay */}
        <motion.div
          className="fixed inset-0 z-[100] pointer-events-none"
          initial={{ scale: 0, borderRadius: '50%' }}
          animate={{ scale: 0, borderRadius: '50%' }}
          exit={{ scale: 3, borderRadius: '0%' }}
          transition={{
            duration: 0.8,
            ease: [0.76, 0, 0.24, 1],
          }}
          style={{
            background: 'radial-gradient(circle, rgba(99,102,241,0.9), rgba(236,72,153,0.9), rgba(34,211,238,0.9))',
            filter: 'blur(60px)',
            transformOrigin: 'center center',
          }}
        />

        {children}
      </motion.div>
    </AnimatePresence>
  )
}

// Liquid droplet transition component
export function LiquidTransition() {
  return (
    <motion.div
      className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Central liquid sphere */}
      <motion.div
        className="relative"
        initial={{ scale: 0, rotate: 0 }}
        animate={{ scale: 1, rotate: 180 }}
        exit={{ scale: 0, rotate: 360 }}
        transition={{
          duration: 1.2,
          ease: [0.76, 0, 0.24, 1],
        }}
      >
        {/* Outer glow */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            width: '300px',
            height: '300px',
            background: 'radial-gradient(circle, rgba(99,102,241,0.8), rgba(236,72,153,0.6), transparent)',
            filter: 'blur(80px)',
          }}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.8, 1, 0.8],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        {/* Core sphere */}
        <div
          className="relative rounded-full"
          style={{
            width: '200px',
            height: '200px',
            background: 'linear-gradient(135deg, rgba(99,102,241,0.9), rgba(236,72,153,0.9))',
            boxShadow: '0 0 60px rgba(99,102,241,0.6), inset 0 0 40px rgba(255,255,255,0.3)',
          }}
        >
          {/* Liquid particles */}
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full bg-cyan-400"
              style={{
                width: '20px',
                height: '20px',
                top: '50%',
                left: '50%',
              }}
              animate={{
                x: [0, Math.cos((i * Math.PI * 2) / 8) * 150, 0],
                y: [0, Math.sin((i * Math.PI * 2) / 8) * 150, 0],
                scale: [0, 1, 0],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 1.2,
                delay: i * 0.1,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}
