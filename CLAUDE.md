# T&S Power Grid

## Project Overview

Peer-to-peer power-sharing platform for Nigeria. Solar hosts sell excess capacity to neighbors within ~200m via smart metering, bi-directional meters, and a mobile-first PWA. Currently onboarding Lagos pilot hosts (Lekki, Victoria Island, Ikeja). Revenue model: fixed ₦280/kWh, ~40% under market.

Two host paths: **Full Stack** (₦6M, new install) and **Upgrade Kit** (₦800K+, retrofit existing solar). Enterprise targets: estates, FMCGs, telcos, water pumping stations.

## Tech Stack

- **Framework**: Next.js 14.2 (App Router) — currently all client components in marketing, SSR-safe animations
- **Language**: TypeScript (strict), `@/*` path alias to project root
- **Styling**: Tailwind CSS 3.4 with `cn()` helper (`lib/utils/cn.ts`, clsx + tailwind-merge)
- **UI primitives**: Radix (`@radix-ui/react-dialog`, `react-slot`) + `class-variance-authority` for variants
- **Database/Auth**: Supabase (`@supabase/ssr`, `@supabase/supabase-js`) — client exported from `lib/supabase/client.ts`, currently returns `null` fallback when env vars absent
- **Forms**: react-hook-form + zod (via `@hookform/resolvers`)
- **Icons**: lucide-react
- **Animation**: framer-motion (used in `components/marketing/fade-in.tsx`)
- **Notifications**: sonner (`<Toaster position="top-center" richColors />` in root layout)
- **Charts**: recharts
- **Dates**: date-fns
- **Package manager**: pnpm

Scripts: `pnpm dev`, `pnpm build`, `pnpm start`, `pnpm lint`. No test runner configured yet.

## Directory Structure

```
app/                      # Next.js App Router (flat — no route groups yet)
  layout.tsx              # Root layout: fonts, metadata, Toaster
  page.tsx                # Marketing landing (client component)
  globals.css
  design-system/page.tsx  # Component showcase / reference
  fonts/                  # Local woff fallbacks
components/
  ui/                     # Design-system primitives (button, badge, card, dialog, input, nav, etc.) — barrel export via index.ts
  marketing/              # Landing-page-specific (marquee, lead-form, fade-in)
lib/
  supabase/client.ts      # Supabase browser client
  utils/cn.ts             # Tailwind class merger
public/                   # PWA manifest, images
```

Expected (per README, not yet built): Auth, Host, Admin, API route segments under `app/`.

## Environment Variables (`.env.example`)

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`, `PAYSTACK_SECRET_KEY` (payments)
- `TERMII_API_KEY` (SMS)
- `NEXT_PUBLIC_APP_URL`

## Design System

### Colors (tailwind.config.ts)
- **navy** scale `700–950` — primary dark (navy-950 `#051530` is near-black)
- **yellow** scale `100–500` — brand accent (yellow-500 `#FFB800`)
- Semantic: `green`, `red`, `amber` (flat, not scales)
- Surfaces: `paper #F5F2EA`, `offwhite #FAFAF7` — page backgrounds, not white

### Typography
- `font-display` → Fraunces (serif, italic accents for emphasis)
- `font-sans` → Plus Jakarta Sans via `--font-general-sans` variable (standing in for General Sans)
- `font-mono` → JetBrains Mono — used for numbers/stats (`₦4,250.00`), uppercase eyebrow labels

### Component Patterns (`components/ui/`)
- **CVA + forwardRef**: variants declared with `cva()`, exported alongside the component (e.g. `buttonVariants`). Props extend native HTML + `VariantProps<typeof ...>`.
- **asChild** pattern via `@radix-ui/react-slot` (see `Button`) for polymorphic composition.
- **cn()** always used to merge className — never string-concat.
- Rounded corners trend large: buttons `rounded-[12px]`, cards often `rounded-2xl` or `rounded-[32px]`.
- `active:scale-[0.98]` micro-interaction on interactive elements.
- Button sizes: `sm h-9 / md h-11 / lg h-14`. Marketing hero uses `h-14 px-8` with bold text.
- Barrel export from `components/ui/index.ts` — import as `from "@/components/ui"`.

### Marketing Patterns (`app/page.tsx`)
- Client component wrapped in `<Suspense>` with `bg-offwhite` fallback.
- Sections numbered in comments (1. Nav, 2. Hero, …, 10. Footer) — preserve numbering when editing.
- `<FadeIn>` wrapper (framer-motion) with optional `direction` and `delay` props for staggered entrances.
- Eyebrow labels: `text-xs/sm uppercase tracking-widest font-bold` in muted navy or yellow.
- Stat presentation: mono font, large, often yellow on navy-950 backgrounds.
- Mix of Nigerian-specific copy (NEPA, ₦, Lagos) — keep voice.

## Conventions

- **Imports**: `@/components/ui`, `@/lib/utils/cn`, `@/lib/supabase/client`.
- **File naming**: kebab-case for files (`stat-card.tsx`, `bottom-nav.tsx`), PascalCase exports.
- **"use client"** at top of interactive components; marketing page is fully client currently.
- **Images**: `next/image` with explicit `width`/`height`; hero uses `priority`.
- **Comments**: sparse; only for non-obvious intent (see layout's note on Plus Jakarta substitution).
- **Supabase client**: guard against missing env vars (returns null) — preserve this pattern or migrate to explicit checks when adding auth-gated pages.

## Authentication

### Phone OTP flow (Option B — synthetic email)
1. `/sign-in` → POST `/api/auth/send-otp` → `lib/auth/otp.ts::sendPhoneOtp`
   - Normalises phone to E.164, rate-limits (3 per 15 min via `otp_challenge_count_recent`).
   - Calls `create_otp_challenge()` SQL fn (bcrypt hash). Tries Termii; dev fallback: console.
   - Returns `otpToken` (= challenge row `id`, 122-bit UUID).
2. `/verify-otp` → POST `/api/auth/verify-otp` → `verifyPhoneOtp`
   - Validates via `verify_otp_challenge()` SQL fn. Challenge consumed on ANY attempt (no brute force).
   - On success: calls `auth.admin.createUser` for new users (email = `+234…@phone.tspowergrid.local`).
   - `auth.admin.generateLink({ type: 'magiclink', email })` → returns `hashed_token`.
   - Client calls `supabase.auth.verifyOtp({ token_hash, type: 'magiclink' })` → session.
3. New user → `/onboarding` (multi-step, URL `?step=1-5`). Existing user → `/host/home`.

### handle_new_profile trigger
`handle_new_profile()` fires **after INSERT on public.profiles**, not on auth.users. The API route inserts the profile row explicitly on first sign-in; the trigger auto-creates the wallet. Do not skip the profile insert.

### otp_challenges table
Service-role only (no RLS policies = no authenticated access). Row `id` is the opaque token. `consumed_at` is set on first verify attempt — correct code or not. Stale rows should be purged by a scheduled job (see migration comment).

### Admin auth
Email + password via `supabase.auth.signInWithPassword`. Role checked post-auth against `profiles.role`. Non-admin accounts are signed out immediately.

### Role-based routing (middleware)
- `/host/*` → requires valid session (any role).
- `/admin/*` (except `/admin/sign-in`) → requires session + `role in ('admin','super_admin')`.
- Wrong role → redirect to `/`.

### Hooks
- `useUser()` — returns `Profile | null`. SWR-cached (30 s). Subscribes to `onAuthStateChange`.
- `useRole()` — `{ isHost, isNeighbor, isAdmin, isSuperAdmin, isLoaded }`.

### Supabase clients
| Module | Where used | Client factory |
|---|---|---|
| `lib/supabase/client.ts` | Client components | `createBrowserClient` (@supabase/ssr) |
| `lib/supabase/server.ts` | Server components / route handlers | `createServerClient` with `next/headers` cookies |
| `lib/supabase/admin.ts` | API routes needing service-role | `createClient` with `SUPABASE_SERVICE_ROLE_KEY` |
| `lib/supabase/middleware.ts` | Root middleware | `createServerClient` with request/response cookies |

## Patterns to Preserve

1. `cn()` for all className merging.
2. CVA for any component with visual variants.
3. Barrel imports from `@/components/ui`.
4. Navy + yellow palette; avoid introducing new semantic colors without extending `tailwind.config.ts`.
5. Mono font for numeric/financial displays.
6. Fraunces (display serif) for headings; italic span for emotive emphasis.
7. Mobile-first + PWA metadata already wired in `app/layout.tsx` — keep `manifest`, `appleWebApp`, `themeColor` intact.
8. SSR-safe animation wrappers (`FadeIn`) rather than raw framer-motion in marketing sections.
