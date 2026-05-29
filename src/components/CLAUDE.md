# src/components/CLAUDE.md

This file provides guidance for Claude Code when working with React components in this directory.

## Overview

This directory contains all UI components organized by feature area:

- **chat/** — Chat interface components (MessageList, MessageInput, ChatInterface)
- **editor/** — Code editor components (FileTree, CodeEditor)
- **auth/** — Authentication components (SignInForm, SignUpForm, AuthDialog)
- **preview/** — Virtual file system preview (PreviewFrame)
- **ui/** — shadcn/ui primitives (low-level, mostly generated; avoid editing)

## Component Patterns

### Client Components ("use client")

All components in this directory are client components. Include `"use client"` at the top of every `.tsx` file.

```typescript
"use client";

import { useState } from "react";
// ... rest of file
```

**Why:** Interactivity requires client-side state and event handlers. Server Components can't use hooks.

### Naming Convention

- **Components** (exported React components): PascalCase (e.g., `ChatInterface`, `FileTree`)
- **Props interfaces**: Component name + `Props` suffix (e.g., `ChatInterfaceProps`, `SignInFormProps`)
- **Files**: Match the primary exported component (e.g., `ChatInterface.tsx` exports `ChatInterface`)

### Props & Interfaces

Always define a props interface, even if empty. Example:

```typescript
interface SignInFormProps {
  onSuccess?: () => void;
}

export function SignInForm({ onSuccess }: SignInFormProps) {
  // ...
}
```

**Why:** Makes the component's contract explicit and searchable.

### Styling

Use Tailwind CSS utility classes directly in `className`. No CSS modules or styled-components.

```typescript
<div className="flex flex-col h-full p-4 gap-2">
  {/* tailwind utilities: flex, flex-col, height, padding, gap */}
</div>
```

**Why:** Consistent with the project's build setup (Turbopack + Next.js).

## Context & State Management

### Reading Context

Use context hooks from `src/lib/contexts/` to access shared state:

```typescript
import { useChat } from "@/lib/contexts/chat-context";
import { useFileSystem } from "@/lib/contexts/file-system-context";
import { useAuth } from "@/hooks/use-auth";

export function ChatInterface() {
  const { messages, input, handleInputChange } = useChat();
  // ...
}
```

**Why:** Avoids prop drilling and keeps components decoupled from the component tree structure.

### Local State

Use `useState` for local UI state (form inputs, expanded/collapsed, loading flags):

```typescript
const [isExpanded, setIsExpanded] = useState(true);
const [error, setError] = useState("");
```

Don't duplicate global state locally; read it from context.

## Testing

Test files live in `__tests__` subdirectories alongside source components:

```
chat/
  ChatInterface.tsx
  __tests__/
    ChatInterface.test.tsx
```

**Why:** Colocates tests with source, making them easy to find and maintain.

Test patterns:

```typescript
import { render, screen } from "@testing-library/react";
import { ChatInterface } from "../ChatInterface";

describe("ChatInterface", () => {
  it("renders message list", () => {
    render(<ChatInterface />);
    expect(screen.getByRole("list")).toBeInTheDocument();
  });
});
```

## UI Library (shadcn/ui)

Use shadcn/ui components from `src/components/ui/`:

```typescript
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export function SignInForm() {
  return (
    <form>
      <Input placeholder="Enter email" />
      <Button type="submit">Sign In</Button>
    </form>
  );
}
```

**Why:** Pre-styled, accessible Radix UI primitives; already integrated into the project.

Do **not** edit files in `ui/` directly — they are generated from the shadcn/ui CLI.

## Common Imports

Most components will need:

```typescript
"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
// ... others as needed
```

Use the `@/` alias for absolute imports (configured in `tsconfig.json`).

## Anti-Patterns

- ❌ **Don't use `any`** — define proper TypeScript interfaces
- ❌ **Don't duplicate global state in local state** — read from context instead
- ❌ **Don't add server-side logic** — keep components in the view layer
- ❌ **Don't edit `ui/` components** — they are generated; extend via composition instead
- ❌ **Don't use external CSS files** — use Tailwind utility classes
