# src/lib/auth.ts

httpOnly: false — cookies are now readable by JavaScript, opening XSS attack surface
secure: false — tokens sent over plain HTTP even in production
console.log("Created session token:", token) — JWT token logged to server output (credential leak)


# src/app/api/chat/route.ts

console.log(JSON.stringify({ messages, files, projectId })) — full chat history and file content logged on every request (data leak)
Removed userId: session.userId from the Prisma where clause — any authenticated user can now overwrite any project by ID (IDOR / broken access control)


# src/lib/file-system.ts

// TODO: handle .. traversal later comment acknowledging a known path traversal hole without fixing it
replaceInFile now returns an error and skips the replacement when there is exactly one occurrence — which is the normal case, so the tool Claude relies on would silently fail for most edits