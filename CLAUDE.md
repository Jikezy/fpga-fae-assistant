# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FPGA FAE Assistant — AI-powered FPGA Field Application Engineer consulting platform using Claude AI + RAG (Retrieval-Augmented Generation) for technical support and document analysis.

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + React 18 + TypeScript + Tailwind CSS
- **3D Graphics**: Three.js + Custom GLSL Shaders
- **Animations**: Framer Motion
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL (Neon Serverless) + @neondatabase/serverless
- **AI**: Anthropic Claude SDK (@anthropic-ai/sdk) - Model: claude-opus-4-20250514
- **PDF Processing**: unpdf
- **State Management**: Zustand
- **Markdown Rendering**: react-markdown + remark-gfm + react-syntax-highlighter

## Common Commands

```bash
npm install          # Install dependencies
npm run dev          # Start development server (http://localhost:3000)
npm run build        # Production build
npm start            # Start production server
npm run lint         # Run ESLint
```

**Note**: Project uses `.npmrc` with `legacy-peer-deps=true` to resolve React 18 dependency conflicts with @react-three/drei.

## Architecture

### Directory Structure

```
app/
├── api/               # API Routes
│   ├── auth/         # Authentication (login, register, logout, me)
│   ├── chat/         # Streaming chat endpoint (SSE)
│   ├── documents/    # Document CRUD operations
│   ├── pdf/          # PDF analysis (full-read, full-read-by-name)
│   ├── upload/       # File upload handler
│   ├── search/       # Vector search
│   ├── user/         # User settings (API key management)
│   └── admin/        # Admin operations (users list, migrate)
├── landing/          # Public landing page
├── login/            # Login page
├── register/         # Registration page
├── chat/             # Main chat interface (requires auth)
├── settings/         # User settings page
├── admin/            # Admin dashboard
└── page.tsx          # Root redirect handler

components/
├── LiquidGlassBackground.tsx  # 3D WebGL fluid background
├── ChatInterface.tsx          # Main chat component
├── Sidebar.tsx                # Document library + chat history
├── Header.tsx                 # Top navigation bar
├── MessageList.tsx            # Chat message display
├── ChatInput.tsx              # Message input field
├── DocumentList.tsx           # PDF document list with sorting
└── PageTransition.tsx         # Liquid morphing transitions

lib/
├── ai-service.ts              # Anthropic Claude API wrapper
├── simpleVectorStore.ts       # PostgreSQL-based vector store (TF-IDF + Jaccard)
├── pdfProcessor.ts            # PDF text extraction with chunking
├── auth.ts                    # Session management utilities
├── auth-middleware.ts         # API authentication middleware
└── db-schema.ts               # Database schema + auto-initialization
```

### Routing Architecture

- **`/`** → Auto-redirect (unauthenticated → `/landing`, authenticated → `/chat`)
- **`/landing`** → Public landing page (AI chatbot platform showcase)
- **`/chat`** → Main chat interface (protected)
- **`/login` / `/register`** → Redirect to `/chat` after successful auth
- **Middleware** (`middleware.ts`): Handles auth redirects and public path exemptions

### UI Design System: Clean & Airy + Liquid Glass

**Color Scheme**:
- **Primary Text**: `gray-800` (dark charcoal for high contrast)
- **Secondary Text**: `gray-600`, `gray-700` (metadata, labels)
- **Subtle Text**: `gray-500` (placeholders)
- **Backgrounds**: `white/95`, `gray-50/90` (high opacity glass cards)
- **Borders**: `gray-200/60`, `gray-300` (subtle separation)
- **AI Purple Accent**: `purple-500` (#7C3AED), `purple-600` (landing page CTA)
- **Blue Accent**: `blue-400` to `blue-600` (buttons, icons, AI avatar)
- **PDF Red**: `red-600` (PDF document icons for visibility)

**Contrast Guidelines** (Critical for Readability):
- All body text: `text-gray-800` + `font-medium` or `font-semibold`
- Timestamps: `text-gray-600` + `font-medium` (NOT white/transparent)
- PDF icons: `text-red-600` (high contrast, recognizable)
- Document metadata: `text-gray-700` + `font-medium`
- Button text: White on dark backgrounds, `gray-800` on light backgrounds
- Active states: `bg-blue-100 text-blue-800` for selected items

**3D Liquid Glass Background** (`LiquidGlassBackground.tsx`):
- Custom GLSL vertex/fragment shaders with Three.js
- Studio lighting effect: silver-white → ice-blue gradient
- Color palette: `vec3(0.95, 0.96, 0.98)` to `vec3(0.82, 0.87, 0.93)`
- Gentle fluid motion (0.05 speed for elegance)
- Minimal mouse interaction (reduced 70% from original)
- Plane size: 15×12, 48×48 subdivision

**Glass Morphism Cards**:
- Opacity: `from-white/95 to-gray-50/90`
- Blur: `backdrop-blur-[60px] backdrop-saturate-[200%]`
- Borders: `border-gray-200/60`
- Shadows: `shadow-[0_8px_32px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.8)]`
- Text: Dark charcoal (`text-gray-800`) for high contrast

**Z-Index Layers**:
```
-10: 3D background (WebGL canvas)
0:   Subtle gradient overlay
20:  Main content area
30:  Header navigation
50:  Sidebar
100: Page transitions
```

## Database Schema

| Table | Purpose |
|---|---|
| `users` | User accounts (email, password hash, role, anthropic_api_key) |
| `sessions` | Login sessions (30-day expiry, token stored in HTTP-only cookie) |
| `documents` | PDF document chunks (500 chars + 100 char overlap, user_id isolation) |
| `embeddings` | Document vectors (TF-IDF + Jaccard similarity, user_id isolation) |

**Auto-initialization**: `lib/db-schema.ts` creates tables on first API call if not exist.

## Core Workflows

### 1. Authentication Flow

**Session-based** (not JWT):
- Login → Create session in DB → Set `auth_token` HTTP-only cookie
- Middleware checks token on every protected route
- API endpoints use `requireAuth()` or `requireAdmin()` from `lib/auth-middleware.ts`

**User Roles**:
- `admin`: Can use system default ANTHROPIC_API_KEY
- `user`: Must configure personal API key via `/settings`

### 2. RAG Pipeline

```
1. PDF Upload
   ├─ FormData → /api/upload
   ├─ unpdf extracts text
   ├─ Split into 500-char chunks (100 overlap)
   └─ Insert into documents + embeddings tables

2. Query Processing
   ├─ User question → /api/chat
   ├─ simpleVectorStore.search() → TF-IDF + Jaccard similarity
   ├─ Retrieve top-k chunks (threshold: 0.005)
   └─ Return balanced results (3 chunks per document)

3. Context Injection
   ├─ Concatenate chunks into RAG context
   ├─ Prepend to user message (NOT system role)
   └─ Format: 【参考文档】...【用户问题】...

4. AI Response
   ├─ Anthropic Claude API (streaming)
   ├─ Server-Sent Events (SSE)
   └─ Frontend: EventSource + real-time rendering
```

**Critical Pattern** (Anthropic-specific):
```typescript
// ✅ CORRECT: Append RAG context to user message
const messages = [
  {
    role: 'user',
    content: `【参考文档】\n${ragContext}\n\n【用户问题】\n${userQuestion}`
  }
]

// ❌ WRONG: Using system role in messages array (Anthropic ignores it)
const messages = [
  { role: 'system', content: ragContext },
  { role: 'user', content: userQuestion }
]
```

**Reason**: Anthropic's `system` parameter is separate from `messages`. Do NOT put system content inside messages array. The system prompt is passed separately to the API via the `system` parameter in `lib/ai-service.ts`.

### 3. AI Service Configuration

**API Key Priority**:
1. User's personal key (`user.anthropic_api_key` from database)
2. System default key (`process.env.ANTHROPIC_API_KEY`)

**API Endpoint**:
- Base URL: `https://yunwu.ai` (云雾 AI proxy, NOT official Anthropic API)
- Model: `claude-opus-4-20250514`
- Streaming: Always enabled via SSE

### 4. Vector Search Implementation

**Algorithm** (`lib/simpleVectorStore.ts`):
- TF-IDF vectorization (term frequency × inverse document frequency)
- Cosine similarity + Jaccard similarity for ranking
- Chinese/English text segmentation
- Multi-document balancing (max 3 chunks per document)

**Optimization for Overview Questions**:
- Detect keywords: "什么", "讲", "pdf", "介绍"
- Return document opening chunks for broad context

## API Endpoints

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/auth/register` | POST | Public | Create new user account |
| `/api/auth/login` | POST | Public | Create session + set cookie |
| `/api/auth/logout` | POST | Required | Delete session |
| `/api/auth/me` | GET | Required | Get current user info |
| `/api/chat` | POST | Required | Streaming chat (SSE) |
| `/api/upload` | POST | Required | Upload PDF (FormData, 10MB limit) |
| `/api/documents` | GET/DELETE | Required | List/delete user documents |
| `/api/documents/clear` | DELETE | Required | Delete all user documents |
| `/api/search` | POST | Required | Vector similarity search |
| `/api/pdf/full-read` | POST | Required | Full PDF analysis (streaming) |
| `/api/pdf/full-read-by-name` | POST | Required | Analyze PDF by filename |
| `/api/user/settings` | GET/POST/DELETE | Required | Manage user API key |
| `/api/admin/users` | GET | Admin | List all users |
| `/api/admin/migrate` | POST | Admin | Run database migrations |

## Environment Variables

```bash
# AI Service (Anthropic Claude only)
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-xxx...
ANTHROPIC_BASE_URL=https://yunwu.ai  # REQUIRED: Use 云雾 AI proxy

# Database (Neon PostgreSQL)
POSTGRES_URL=postgresql://...  # Auto-injected by Spaceship/Vercel

# Application Config
NEXT_PUBLIC_APP_NAME=FPGA FAE助手
NEXT_PUBLIC_MAX_FILE_SIZE=10485760  # 10MB
```

**Critical**:
- `ANTHROPIC_BASE_URL` **MUST** be `https://yunwu.ai` (not official API)
- Production env vars configured in Spaceship dashboard (NOT from `.env` file)

## Deployment

### Cloud Auto-Deploy

- **Git Repository**: https://github.com/Jikezy/fpga-fae-assistant
- **Platform**: Spaceship (auto-deploy on push to `main`)
- **Database**: Neon PostgreSQL (serverless)
- **Build**: Spaceship runs `npm install` with `.npmrc` config

### Workflow

```bash
# After making changes
git add .
git commit -m "Description"
git push origin main

# Spaceship auto-deploys in 1-3 minutes
```

## Key Implementation Notes

### SSE Streaming Pattern

All AI chat endpoints use Server-Sent Events:

```typescript
const stream = new ReadableStream({
  async start(controller) {
    await aiService.streamChat(messages, (chunk) => {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`))
    })
    controller.enqueue(encoder.encode('data: [DONE]\n\n'))
    controller.close()
  }
})

return new Response(stream, {
  headers: {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  }
})
```

### User Data Isolation

All document queries include `user_id` filter:

```typescript
// Always scope to current user
const documents = await sql`
  SELECT * FROM documents
  WHERE user_id = ${userId}
`
```

### Path Aliases

`@/*` maps to project root (configured in `tsconfig.json`):

```typescript
import Component from '@/components/Component'
import { utility } from '@/lib/utility'
```

### GLSL Shader Structure

Liquid Glass background uses vertex shader for geometry deformation and fragment shader for color/lighting:

- **Vertex Shader**: Simplex noise + mouse magnetic attraction
- **Fragment Shader**: Multi-layer color mixing + caustics + edge glow
- **Uniforms**: `uTime`, `uMouse`, `uResolution`

### Code Highlighting

Use `oneLight` theme for syntax highlighting (light theme for consistency):

```typescript
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'

<SyntaxHighlighter
  style={oneLight as any}
  customStyle={{
    background: 'rgba(248, 250, 252, 0.95)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(226, 232, 240, 0.8)',
    borderRadius: '1rem',
  }}
>
```

## UIPro Integration

Project includes UIPro CLI skill pack (`.claude/skills/ui-ux-pro-max/`):

- 67 design styles + 96 color palettes
- 57 font pairings + 99 UX guidelines
- 25 chart types + 13 tech stacks
- Query via: `python .claude/skills/ui-ux-pro-max/scripts/search.py --domain <domain> "<query>"`
