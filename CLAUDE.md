# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run setup        # First-time setup: install deps, generate Prisma client, run migrations
npm run dev          # Start dev server (uses Turbopack + node-compat.cjs)
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Vitest unit tests
npm run db:reset     # Reset SQLite database
```

The dev server requires `NODE_OPTIONS='--require ./node-compat.cjs'` (handled by the `dev` script automatically).

## Architecture

**UIGen** is a Next.js 15 App Router app where users describe React components in natural language and Claude AI generates them with live preview.

### Key Data Flow

```
User prompt → ChatInterface (useChat) → POST /api/chat
  → Claude (Vercel AI SDK, streaming) + tool calls
  → VirtualFileSystem (in-memory) updates
  → FileSystemContext (React state) propagates to:
      - PreviewFrame: Babel transpiles + renders in iframe
      - CodeEditor + FileTree: display generated files
  → Auto-save to Prisma/SQLite (authenticated users)
```

### AI Integration (`src/app/api/chat/route.ts`)

The chat API uses the Vercel AI SDK with two Claude tools:
- `str_replace_editor` — create/edit files
- `file_manager` — delete, rename, move files

Model is defined in `src/lib/provider.ts` (Claude Haiku 4.5 by default). If `ANTHROPIC_API_KEY` is not set, a `MockLanguageModel` is used that generates demo components with simulated tool calls.

### Virtual File System (`src/lib/file-system.ts`)

An in-memory tree (no disk writes). Claude writes to it via tool calls; React state propagates changes to the UI. Serialized as JSON for database persistence.

### State Management

Two React contexts manage all shared state:
- `FileSystemProvider` (`src/lib/contexts/file-system-context.tsx`) — virtual FS state + operations
- `ChatProvider` (`src/lib/contexts/chat-context.tsx`) — AI messages and chat history

### Authentication (`src/lib/auth.ts`)

JWT-based (jose, HS256) with HttpOnly cookies (7-day expiration). Server Actions in `src/actions/` handle sign-in, sign-up, and project CRUD. Anonymous users get localStorage tracking via `src/lib/anon-work-tracker.ts` with migration to a project on sign-up.

### Database

Prisma ORM + SQLite (`prisma/dev.db`). Schema has two models: `User` (email/password) and `Project` (name, messages JSON, file data JSON). Generated client lives at `src/generated/prisma/`.

### Path Alias

`@/*` maps to `src/*` (configured in `tsconfig.json`).
