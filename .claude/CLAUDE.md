# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

UIGen is an AI-powered React component generator with live preview. Users describe components in a chat; Claude generates them via tool calls into a virtual file system; the result renders instantly in an iframe using Babel Standalone.

## Commands

```bash
npm run setup        # First-time setup: install, prisma generate, migrate dev
npm run dev          # Dev server with Turbopack on localhost:3000
npm run build        # Production build
npm run lint         # ESLint
npm test             # Vitest (jsdom)
npm test -- src/lib/__tests__/file-system.test.ts  # Single test file
npm run db:reset     # Destructive DB reset
```

**Do not run `npm audit fix`** — dependencies are pinned to specific compatible versions.

## Environment

Copy `.env` and set your key:
```
ANTHROPIC_API_KEY=sk-ant-...
JWT_SECRET=your-secret     # optional, has development default
```

If `ANTHROPIC_API_KEY` is missing or still the placeholder `your-api-key-here`, the app falls back to `MockLanguageModel` and returns canned components.

## Architecture

### Three core layers

**1. Chat API** (`src/app/api/chat/route.ts`)
- POST endpoint that streams Claude responses via Vercel AI SDK `streamText()`
- Uses model `claude-haiku-4-5` (defined in `src/lib/provider.ts`)
- Exposes two tools to Claude: `str_replace_editor` and `file_manager`
- System prompt uses `anthropic.cacheControl: { type: "ephemeral" }` for prompt caching
- On stream completion, saves serialized VFS + messages to the database if authenticated

**2. Virtual File System** (`src/lib/file-system.ts`)
- `VirtualFileSystem` class stores files entirely in memory — nothing is written to disk
- Client holds a serialized `Record<string, FileNode>` and sends it on every request
- Server calls `fileSystem.deserializeFromNodes(files)` to reconstruct state
- Claude modifies files through tool calls; updated state is serialized back to the client
- `Project.data` in the database stores the serialized VFS as a JSON string

**3. Preview & Transform** (`src/components/preview/PreviewFrame.tsx`, `src/lib/transform/jsx-transformer.ts`)
- Babel Standalone compiles JSX/TSX client-side and renders in a sandboxed iframe
- `/App.jsx` must exist as the root entry point — Claude always creates it
- CSS imports and missing module imports are stripped/tracked rather than erroring
- React 19 and React DOM are available as built-in imports in the transform context

### Authentication

- JWT tokens stored in httpOnly cookies (7-day expiry) via `jose`
- `src/lib/auth.ts` — `getSession()` / `createSession()` / `deleteSession()`
- `src/hooks/use-auth.ts` — client-side auth state
- `src/actions/` — Server Actions for sign-up, sign-in, sign-out, project CRUD
- Anonymous users work fully in-memory; authenticated users persist projects to SQLite

@docs/database.md

### Key directories

- `src/app/` — Next.js App Router: `page.tsx` (home), `[projectId]/page.tsx` (project), `api/chat/route.ts`
- `src/lib/tools/` — Tool definitions (`str-replace.ts`, `file-manager.ts`) passed to Claude
- `src/lib/prompts/generation.tsx` — System prompt instructing Claude on component generation
- `src/lib/contexts/` — React Context for FileSystem and Chat state
- `src/components/chat/` — ChatInterface, MessageList, MessageInput, MarkdownRenderer
- `src/components/editor/` — FileTree, CodeEditor (Monaco Editor)
- `src/components/ui/` — shadcn/ui Radix primitives

## Styling & CSS

Use **Tailwind CSS** utility classes exclusively. No CSS modules, styled-components, or external stylesheets.

```typescript
<div className="flex flex-col h-full p-4 gap-2 bg-gray-50">
  {/* Tailwind utilities: flex, flex-col, height, padding, gap, background */}
</div>
```

**Why:** Consistent across the entire project, integrated with Turbopack + Next.js build pipeline, faster than runtime CSS-in-JS.

Configure Tailwind in `tailwind.config.ts` for any custom values; don't inline magic numbers or colors.

## Testing

### File Colocation

Test files live in `__tests__` subdirectories alongside source files:

```
src/lib/
  file-system.ts
  __tests__/
    file-system.test.ts

src/components/chat/
  ChatInterface.tsx
  __tests__/
    ChatInterface.test.tsx
```

**Why:** Tests are easy to find, maintain, and run alongside their source. Discourages "test dungeon" separation.

### Test Framework

Use **Vitest** with `jsdom` for DOM testing. Run:

```bash
npm test                                               # Run all tests
npm test -- src/lib/__tests__/file-system.test.ts    # Single file
```

### Patterns

- Use `@testing-library/react` for component tests
- Query by semantic role/label, not implementation details (`getByRole`, `getByLabelText`)
- Test behavior, not implementation (what the user sees, not how the code works)

## Commenting

Use comments sparingly. Only comment complex code. <!-- Vague instruction — a Claude certified architect advises against guidance like this, as Claude cannot reliably judge what counts as "complex" without concrete examples or criteria. -->