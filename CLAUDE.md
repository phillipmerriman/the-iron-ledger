# Project Instructions

## Error Messages
- Never show raw or technical errors to users (e.g. stack traces, ".map is not a function", internal variable names)
- User-facing error messages must explain what happened in plain language and tell the user what to do next (e.g. "Could not reach the nutrition database. Check your connection and try again.")
- Log technical details to `console.error` for debugging — never surface them in the UI
- If an error is recoverable (e.g. cache miss, optional service unavailable), handle it silently and fall through to the next option rather than showing an error
- When showing errors inline, provide a way to dismiss or retry
