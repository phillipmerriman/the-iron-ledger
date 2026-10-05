# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start        # dev server (http://localhost:5173)
npm run build    # tsc + vite build (check TypeScript before shipping)
npm run lint     # eslint
```

There are no automated tests. Verify features manually in the browser.

## Environment

Create a `.env.local` with the following to connect to Supabase:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_USDA_API_KEY=...   # optional; falls back to DEMO_KEY (rate-limited)
```

If these vars are absent, `isDev` is `true` and the app runs entirely in localStorage — no login required, a mock user is injected automatically.

## Architecture

**Stack**: React 19, TypeScript, Vite, Tailwind CSS v4, Supabase (auth + Postgres), React Router v7, Recharts, date-fns.

**Dev vs. prod data layer** — every hook branches on `isDev` from `src/lib/supabase.ts`:
- `isDev = true` → `localDb` (thin localStorage wrapper at `src/lib/local-storage.ts`)
- `isDev = false` → Supabase client queries

All hooks follow this dual-path pattern. When adding new data operations, implement both paths.

**Data types** — `src/types/database.ts` is the single source of truth for all table shapes. It exports `Tables<T>`, `InsertDto<T>`, and `UpdateDto<T>` convenience generics plus named aliases (e.g. `Exercise`, `WorkoutSession`). Domain-level types that don't map directly to DB rows live in `src/types/common.ts` (exercise colors, rep types, weight units, volume math) and `src/types/meal-types.ts` (meal slots, macro helpers, ingredient units).

**State management** — no global store. Each domain has a custom hook in `src/hooks/` that owns state and exposes CRUD operations:
- `useWorkouts` / `useWorkoutSets` — sessions and sets
- `useWorkoutTemplates` — workout templates
- `useWeeklyPlan` / `usePrograms` — planning and multi-week programs
- `useExercises` — exercise library
- `useRecipes` / `useMealPlan` / `useMealSummary` / `useNutrition` — meal tracking
- `useTimers` / `useStats` / `useStats` — timers and analytics

**Auth** — `src/contexts/AuthContext.tsx` wraps Supabase auth and injects a mock session when `isDev`. New users are seeded with default exercises on first login (`src/lib/seed-exercises.ts`).

**Nutrition lookup** — `src/lib/nutrition-api.ts` queries USDA FoodData Central. All results are per-100g and must be scaled with `scaleNutritionResult()`. `src/lib/nutrition-cache.ts` caches queries to the `nutrition_cache` Supabase table.

**Path alias** — `@/` resolves to `src/`.

**UI components** — reusable primitives are in `src/components/ui/` (Button, Card, Input, Modal, Select, etc.). Feature-specific components are co-located under `src/components/<domain>/`.

**Routing** — `src/App.tsx` defines all routes. All app routes are behind `<ProtectedRoute>` which wraps `<AppLayout>` (sidebar + bottom nav).

## Error Messages

- Never show raw or technical errors to users (e.g. stack traces, ".map is not a function", internal variable names)
- User-facing error messages must explain what happened in plain language and tell the user what to do next (e.g. "Could not reach the nutrition database. Check your connection and try again.")
- Log technical details to `console.error` for debugging — never surface them in the UI
- If an error is recoverable (e.g. cache miss, optional service unavailable), handle it silently and fall through to the next option rather than showing an error
- When showing errors inline, provide a way to dismiss or retry
