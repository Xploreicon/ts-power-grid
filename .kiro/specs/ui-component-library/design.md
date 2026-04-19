# Design Document: UI Component Library

## Overview

The T&S Power Grid UI Component Library is a comprehensive collection of 12 reusable React components built with TypeScript, Tailwind CSS, and Next.js 14. The library embodies the design philosophy of "utility-grade trust meets entrepreneurial empowerment" through consistent use of navy (#0A2540) for trust and yellow (#FFB800) for empowerment.

### Design Philosophy

The component library balances three core principles:

1. **Premium Infrastructure Aesthetics**: Components use navy as the foundation color, 12px border radius for modern softness, and subtle shadows to convey reliability
2. **Warmth Through Restraint**: Yellow is used sparingly and strategically for CTAs and earnings displays, creating moments of delight without overwhelming
3. **Accessibility First**: All interactive components support keyboard navigation, include ARIA labels, and provide visible focus states

### Technology Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript 5 with strict mode
- **Styling**: Tailwind CSS 3.4 with custom design tokens
- **Icons**: Lucide React 1.8
- **Utilities**: clsx 2.1, tailwind-merge 3.5
- **Notifications**: Sonner 2.0 (wrapped with custom styling)

### Design Tokens

The library uses a consistent set of design tokens defined in `tailwind.config.ts`:

**Colors:**
- Navy: `#0A2540` (primary), `#051530` (950), `#0F2D4E` (800), `#1E4D8C` (700)
- Yellow: `#FFB800` (primary), `#FFC933` (400), `#FFDA66` (300)
- Semantic: Green `#16A34A`, Red `#DC2626`, Amber `#F59E0B`
- Backgrounds: Paper `#F5F2EA`, Offwhite `#FAFAF7`

**Typography:**
- Display/Headings: Fraunces (serif)
- Body: Plus Jakarta Sans (sans-serif)
- Numbers/Code: JetBrains Mono (monospace)

**Spacing:**
- Standard gaps: 16px, 24px
- Border radius: 12px (0.75rem)
- Shadows: `shadow-sm` (default), `shadow-lg` (elevated)

## Architecture

### File Structure

```
components/
└── ui/
    ├── index.ts                 # Barrel export for all components
    ├── button.tsx               # Button component
    ├── card.tsx                 # Card with subcomponents
    ├── input.tsx                # Input with variants
    ├── badge.tsx                # Badge component
    ├── stat-card.tsx            # Stat card component
    ├── avatar.tsx               # Avatar component
    ├── nav.tsx                  # Top navigation
    ├── bottom-tab-bar.tsx       # Mobile bottom navigation
    ├── toast.tsx                # Toast wrapper
    ├── modal.tsx                # Modal with subcomponents
    ├── skeleton.tsx             # Skeleton loader
    └── empty-state.tsx          # Empty state component

lib/
└── utils/
    └── cn.ts                    # Class name utility

app/
└── design-system/
    └── page.tsx                 # Component showcase
```

### Component Architecture Pattern

All components follow a consistent architecture:

1. **Type Definitions**: Props interface exported alongside component
2. **Variant System**: Union types for variants, sizes, and states
3. **Composition**: Subcomponents exported for complex components (Card, Modal)
4. **Forwarding**: Use `React.forwardRef` for components that need ref access
5. **Accessibility**: ARIA attributes, keyboard handlers, focus management
6. **Styling**: Tailwind classes composed with `cn()` utility

### State Management

Components are stateless where possible, accepting controlled props:
- Form components (Input) accept `value` and `onChange`
- Interactive components (Modal, Nav) accept `open` and `onOpenChange`
- Toast uses Sonner's global state management

### Accessibility Strategy

1. **Keyboard Navigation**: All interactive components respond to Enter, Space, Escape, Tab
2. **Focus Management**: Visible focus rings using Tailwind's `focus-visible:` utilities
3. **ARIA Labels**: `aria-label`, `aria-labelledby`, `aria-describedby` on all semantic elements
4. **Focus Trapping**: Modal implements focus trap using keyboard event handlers
5. **Screen Reader Support**: Semantic HTML elements (`<button>`, `<label>`, `<nav>`)

## Components and Interfaces

### 1. CN Utility (`lib/utils/cn.ts`)

**Purpose**: Safely merge Tailwind CSS classes without conflicts

**Interface:**
```typescript
export function cn(...inputs: ClassValue[]): string
```

**Implementation:**
```typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

**Usage:**
```typescript
cn("px-4 py-2", "bg-navy-900", condition && "text-yellow-500")
// Merges classes, resolving conflicts (e.g., last bg-* wins)
```

---

### 2. Button Component (`components/ui/button.tsx`)

**Purpose**: Primary interactive element with multiple variants and states

**Interface:**
```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger"
  size?: "sm" | "md" | "lg"
  loading?: boolean
  icon?: React.ReactNode
  iconPosition?: "left" | "right"
  asChild?: boolean
  children: React.ReactNode
}
```

**Variant Specifications:**

| Variant | Background | Text | Border | Use Case |
|---------|-----------|------|--------|----------|
| primary | yellow-500 | navy-900 | none | Primary CTAs |
| secondary | transparent | navy-900 | navy-900 | Secondary actions |
| ghost | transparent | navy-900 | none | Tertiary actions |
| danger | red | white | none | Destructive actions |

**Size Specifications:**

| Size | Padding | Font Size | Height |
|------|---------|-----------|--------|
| sm | px-3 py-1.5 | text-sm | ~32px |
| md | px-4 py-2 | text-base | ~40px |
| lg | px-6 py-3 | text-lg | ~48px |

**States:**
- **Loading**: Displays spinner (from Lucide), disables interaction, reduces opacity
- **Disabled**: Reduces opacity to 50%, cursor not-allowed
- **Hover**: Slight opacity change (90% for primary, subtle bg for secondary/ghost)
- **Focus**: Navy ring with offset

**Implementation Notes:**
- Use `disabled={loading || disabled}` to prevent interaction during loading
- Icon positioning uses flexbox with gap-2
- `asChild` pattern allows rendering as different element (e.g., Next.js Link)

---

### 3. Card Component (`components/ui/card.tsx`)

**Purpose**: Container for grouped content with visual boundaries

**Interface:**
```typescript
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "dark"
  interactive?: boolean
  children: React.ReactNode
}

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

interface CardBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}
```

**Variant Specifications:**

| Variant | Background | Border | Shadow | Text |
|---------|-----------|--------|--------|------|
| default | white | navy-700/20 | shadow-sm | navy-900 |
| elevated | white | none | shadow-lg | navy-900 |
| dark | navy-900 | none | shadow-sm | white |

**Interactive State:**
- Hover: `translateY(-2px)` with transition
- Cursor: pointer

**Subcomponent Layout:**
- CardHeader: `p-6 border-b`
- CardBody: `p-6`
- CardFooter: `p-6 border-t`

---

### 4. Input Component (`components/ui/input.tsx`)

**Purpose**: Form field with label, validation, and specialized variants

**Interface:**
```typescript
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
  variant?: "default" | "currency" | "phone"
  icon?: React.ReactNode
}
```

**Variant Specifications:**

| Variant | Prefix | Input Type | Example |
|---------|--------|-----------|---------|
| default | none | text | "John Doe" |
| currency | ₦ | number | "₦ 5000" |
| phone | +234 | tel | "+234 8012345678" |

**Layout Structure:**
```
<div> (wrapper)
  <label> (if provided)
  <div> (input container with prefix/icon)
    <span> (prefix for currency/phone)
    <icon> (if provided)
    <input>
  <p> (hint text, muted)
  <p> (error text, red)
</div>
```

**States:**
- **Default**: Border navy-700/20, bg white
- **Focus**: Ring navy-900, border navy-900
- **Error**: Border red, ring red, error text below
- **Disabled**: Opacity 50%, cursor not-allowed

**Accessibility:**
- Label uses `htmlFor` matching input `id`
- Error uses `aria-describedby` linking to error message
- Hint uses `aria-describedby` for additional context

---

### 5. Badge Component (`components/ui/badge.tsx`)

**Purpose**: Display categorical or status information

**Interface:**
```typescript
interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "yellow" | "navy"
  dot?: boolean
  pulse?: boolean
  children: React.ReactNode
}
```

**Variant Specifications:**

| Variant | Background | Text | Dot Color | Use Case |
|---------|-----------|------|-----------|----------|
| default | gray-100 | gray-800 | gray-400 | Neutral info |
| success | green-100 | green-800 | green-500 | Success states |
| warning | amber-100 | amber-800 | amber-500 | Warnings |
| danger | red-100 | red-800 | red-500 | Errors |
| yellow | yellow-100 | yellow-800 | yellow-500 | Highlights |
| navy | navy-100 | navy-900 | navy-500 | Primary info |

**Dot Indicator:**
- Size: 6px (w-1.5 h-1.5)
- Position: Left of text with gap-1.5
- Pulse: `animate-pulse` when `pulse={true}`

**Typography:**
- Font size: text-xs
- Font weight: font-medium
- Padding: px-2 py-0.5
- Border radius: rounded-full

---

### 6. Stat Card Component (`components/ui/stat-card.tsx`)

**Purpose**: Display numerical metrics with optional trend indicators

**Interface:**
```typescript
interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string | number
  label: string
  trend?: {
    direction: "up" | "down"
    percentage: number
  }
  variant?: "default" | "dark" | "highlight"
}
```

**Variant Specifications:**

| Variant | Background | Value Color | Label Color |
|---------|-----------|-------------|-------------|
| default | white | navy-900 | navy-700 |
| dark | navy-900 | white | navy-300 |
| highlight | yellow-500 | navy-900 | navy-800 |

**Layout Structure:**
```
<div> (card container)
  <div> (value with trend)
    <span> (value in JetBrains Mono, text-3xl)
    <span> (trend indicator)
      <icon> (TrendingUp or TrendingDown)
      <span> (percentage)
  <p> (label, text-sm)
</div>
```

**Trend Indicator:**
- Up: Green text with TrendingUp icon
- Down: Red text with TrendingDown icon
- Font: text-sm font-medium

---

### 7. Avatar Component (`components/ui/avatar.tsx`)

**Purpose**: Visual representation of users with initials

**Interface:**
```typescript
interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string
  size?: "xs" | "sm" | "md" | "lg"
  status?: "online" | "offline" | "idle"
}
```

**Size Specifications:**

| Size | Dimensions | Font Size | Status Dot |
|------|-----------|-----------|------------|
| xs | 24px | text-xs | 6px |
| sm | 32px | text-sm | 8px |
| md | 40px | text-base | 10px |
| lg | 56px | text-lg | 12px |

**Initials Generation:**
```typescript
const getInitials = (name: string): string => {
  return name
    .split(" ")
    .map(part => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}
```

**Status Indicator:**
- Position: Absolute, bottom-0 right-0
- Border: 2px white border
- Colors: online (green), offline (gray-400), idle (amber)

**Styling:**
- Background: navy-900
- Text: yellow-500
- Shape: rounded-full
- Font weight: font-semibold

---

### 8. Nav Component (`components/ui/nav.tsx`)

**Purpose**: Top navigation bar for desktop and mobile

**Interface:**
```typescript
interface NavProps extends React.HTMLAttributes<HTMLElement> {
  logo?: React.ReactNode
  links?: React.ReactNode
  actions?: React.ReactNode
}
```

**Layout Structure:**
```
<nav> (fixed top, full width)
  <div> (container with max-width)
    <div> (logo area)
    <div> (links - hidden on mobile)
    <div> (actions - hidden on mobile)
    <button> (hamburger - visible on mobile)
  <div> (mobile menu - conditional render)
    {links}
    {actions}
</nav>
```

**Responsive Behavior:**
- Desktop (≥768px): Horizontal layout with logo, links, actions
- Mobile (<768px): Logo + hamburger, collapsible menu

**Mobile Menu:**
- Slides down from top
- Background: white with shadow-lg
- Links stacked vertically with py-3
- Closes on link click or outside click

**Styling:**
- Height: 64px
- Background: white
- Border bottom: border-b
- Z-index: z-50

---

### 9. Bottom Tab Bar Component (`components/ui/bottom-tab-bar.tsx`)

**Purpose**: Fixed bottom navigation for mobile PWA

**Interface:**
```typescript
interface BottomTabBarProps {
  activeTab: "home" | "neighbors" | "earnings" | "support"
  onTabChange: (tab: string) => void
}

interface Tab {
  id: string
  label: string
  icon: React.ReactNode
}
```

**Tab Configuration:**
```typescript
const tabs = [
  { id: "home", label: "Home", icon: <Home /> },
  { id: "neighbors", label: "Neighbors", icon: <Users /> },
  { id: "earnings", label: "Earnings", icon: <DollarSign /> },
  { id: "support", label: "Support", icon: <MessageCircle /> }
]
```

**Active State:**
- Text: navy-900
- Icon: navy-900
- Indicator: 3px yellow-500 bar above tab

**Inactive State:**
- Text: navy-700/60
- Icon: navy-700/60

**Layout:**
- Position: fixed bottom-0
- Height: 64px
- Background: white
- Border top: border-t
- Safe area: pb-safe (for iOS notch)
- Grid: 4 equal columns

---

### 10. Toast Component (`components/ui/toast.tsx`)

**Purpose**: Temporary notification messages

**Interface:**
```typescript
// Wrapper component
export { Toaster } from "sonner"

// Custom toast function
interface ToastOptions {
  variant?: "success" | "error" | "info" | "warning"
  duration?: number
}

export function showToast(message: string, options?: ToastOptions): void
```

**Variant Specifications:**

| Variant | Icon | Color | Use Case |
|---------|------|-------|----------|
| success | CheckCircle | green | Success messages |
| error | XCircle | red | Error messages |
| info | Info | navy | Informational |
| warning | AlertTriangle | amber | Warnings |

**Styling Customization:**
```typescript
// In app/layout.tsx
<Toaster 
  position="top-center"
  toastOptions={{
    classNames: {
      toast: "rounded-xl border-navy-700/20",
      title: "font-sans text-navy-900",
      description: "font-sans text-navy-700",
    }
  }}
/>
```

**Behavior:**
- Default duration: 4000ms
- Auto-dismiss: true
- Dismissible: true (X button)
- Stacking: Up to 3 visible

---

### 11. Modal Component (`components/ui/modal.tsx`)

**Purpose**: Overlay dialog requiring user interaction

**Interface:**
```typescript
interface ModalProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
}

interface ModalTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode
}

interface ModalBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

interface ModalFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}
```

**Layout Structure:**
```
<div> (backdrop - fixed inset-0, backdrop-blur-sm)
  <div> (modal container - centered)
    <div> (modal content - white bg, rounded-xl)
      <button> (close button - absolute top-right)
      {children}
```

**Subcomponent Styling:**
- ModalTitle: `text-xl font-display font-semibold p-6 pb-4`
- ModalBody: `p-6 pt-0`
- ModalFooter: `p-6 pt-4 flex justify-end gap-3`

**Focus Management:**
```typescript
useEffect(() => {
  if (open) {
    // Store previously focused element
    const previouslyFocused = document.activeElement
    
    // Focus modal
    modalRef.current?.focus()
    
    // Trap focus within modal
    const handleTab = (e: KeyboardEvent) => {
      // Focus trap logic
    }
    
    return () => {
      // Restore focus on close
      previouslyFocused?.focus()
    }
  }
}, [open])
```

**Keyboard Handlers:**
- Escape: Close modal
- Tab: Cycle through focusable elements within modal

**Accessibility:**
- `role="dialog"`
- `aria-modal="true"`
- `aria-labelledby` pointing to ModalTitle

---

### 12. Skeleton Component (`components/ui/skeleton.tsx`)

**Purpose**: Loading placeholder with shimmer animation

**Interface:**
```typescript
interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number
  height?: string | number
}
```

**Shimmer Animation:**
```css
@keyframes shimmer {
  0% {
    background-position: -1000px 0;
  }
  100% {
    background-position: 1000px 0;
  }
}

.skeleton {
  background: linear-gradient(
    90deg,
    #F5F2EA 0%,
    #FFE999 50%,
    #F5F2EA 100%
  );
  background-size: 1000px 100%;
  animation: shimmer 2s infinite;
}
```

**Default Dimensions:**
- Width: 100% (full container width)
- Height: 20px

**Usage Patterns:**
```typescript
// Text skeleton
<Skeleton width="60%" height="16px" />

// Card skeleton
<Card>
  <CardHeader>
    <Skeleton width="40%" height="24px" />
  </CardHeader>
  <CardBody>
    <Skeleton width="100%" height="16px" />
    <Skeleton width="80%" height="16px" />
  </CardBody>
</Card>
```

---

### 13. Empty State Component (`components/ui/empty-state.tsx`)

**Purpose**: Communicate absence of data with clear messaging

**Interface:**
```typescript
interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description: string
  cta?: {
    label: string
    onClick: () => void
  }
}
```

**Layout Structure:**
```
<div> (centered container, min-h-[400px])
  <div> (icon container, mb-4)
    {icon} (size-12, text-navy-700/40)
  <h3> (title, font-display text-xl)
  <p> (description, text-navy-700 text-sm)
  {cta && <Button>} (optional CTA)
</div>
```

**Styling:**
- Container: `flex flex-col items-center justify-center text-center`
- Max width: `max-w-md mx-auto`
- Padding: `p-8`

**Usage Example:**
```typescript
<EmptyState
  icon={<Inbox />}
  title="No messages yet"
  description="When neighbors send you messages, they'll appear here."
  cta={{
    label: "Invite neighbors",
    onClick: () => router.push("/invite")
  }}
/>
```

## Data Models

### Component Prop Types

All component prop types are exported from their respective files and re-exported from `components/ui/index.ts`:

```typescript
// components/ui/index.ts
export { Button, type ButtonProps } from "./button"
export { Card, CardHeader, CardBody, CardFooter, type CardProps } from "./card"
export { Input, type InputProps } from "./input"
export { Badge, type BadgeProps } from "./badge"
export { StatCard, type StatCardProps } from "./stat-card"
export { Avatar, type AvatarProps } from "./avatar"
export { Nav, type NavProps } from "./nav"
export { BottomTabBar, type BottomTabBarProps } from "./bottom-tab-bar"
export { showToast, Toaster, type ToastOptions } from "./toast"
export { Modal, ModalTitle, ModalBody, ModalFooter, type ModalProps } from "./modal"
export { Skeleton, type SkeletonProps } from "./skeleton"
export { EmptyState, type EmptyStateProps } from "./empty-state"
```

### Shared Type Patterns

**Variant Union Types:**
```typescript
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger"
type CardVariant = "default" | "elevated" | "dark"
type BadgeVariant = "default" | "success" | "warning" | "danger" | "yellow" | "navy"
```

**Size Union Types:**
```typescript
type ButtonSize = "sm" | "md" | "lg"
type AvatarSize = "xs" | "sm" | "md" | "lg"
```

**Status Union Types:**
```typescript
type AvatarStatus = "online" | "offline" | "idle"
type ToastVariant = "success" | "error" | "info" | "warning"
```

### TypeScript Configuration

Components leverage TypeScript's strict mode for maximum type safety:

```typescript
// Extending HTML element props
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  // Custom props
}

// Using generics for flexible typing
interface ModalProps<T = any> {
  data?: T
  onSubmit?: (data: T) => void
}

// Discriminated unions for conditional props
type InputProps = 
  | { variant: "default"; prefix?: never }
  | { variant: "currency"; prefix?: string }
  | { variant: "phone"; prefix?: string }
```

## Error Handling

### Component Error Boundaries

While individual components don't implement error boundaries, they follow defensive coding practices:

**Input Validation:**
```typescript
// Button component
if (loading && !disabled) {
  // Ensure button is disabled when loading
  disabled = true
}

// Avatar component
const getInitials = (name: string): string => {
  if (!name || typeof name !== "string") {
    return "?"
  }
  // ... initials logic
}
```

**Prop Defaults:**
```typescript
// Provide sensible defaults
const {
  variant = "default",
  size = "md",
  loading = false,
  iconPosition = "left",
  ...props
} = buttonProps
```

**Conditional Rendering:**
```typescript
// Modal - prevent rendering when not open
if (!open) return null

// EmptyState - validate required props
if (!icon || !title) {
  console.warn("EmptyState requires icon and title props")
  return null
}
```

### Toast Error Handling

Toast notifications provide user-facing error messages:

```typescript
try {
  await saveData()
  showToast("Data saved successfully", { variant: "success" })
} catch (error) {
  showToast(
    error instanceof Error ? error.message : "Failed to save data",
    { variant: "error" }
  )
}
```

### Form Validation

Input component displays validation errors:

```typescript
<Input
  label="Email"
  type="email"
  error={errors.email}
  // Error displays below input in red
/>
```

### Accessibility Error Prevention

Components prevent common accessibility errors:

1. **Missing Labels**: Input requires label or aria-label
2. **Invalid ARIA**: Modal validates aria-labelledby references
3. **Focus Traps**: Modal ensures focusable elements exist before trapping
4. **Keyboard Navigation**: All interactive elements have keyboard handlers

## Testing Strategy

### Testing Approach

The UI Component Library uses a dual testing approach:

1. **Unit Tests**: Verify specific examples, edge cases, and error conditions using Jest and React Testing Library
2. **Property-Based Tests**: Verify universal properties across randomized inputs using fast-check

### Property-Based Testing Applicability

**PBT IS appropriate** for this feature because:
- Components are pure functions with clear input/output behavior (props → rendered output)
- Universal properties exist (accessibility, styling consistency, type safety)
- Input space is large (various prop combinations, edge cases in strings/numbers)
- Testing parsers/transformations (class name merging, initials generation, input formatting)

**PBT IS NOT appropriate** for:
- Visual rendering verification (use snapshot tests instead)
- Complex user interactions (use integration tests instead)
- Browser-specific behavior (use E2E tests instead)

### Property-Based Testing Library

**Library**: fast-check (TypeScript-native property-based testing)

**Installation**:
```bash
pnpm add -D fast-check @fast-check/jest
```

**Configuration**: Each property test runs minimum 100 iterations

### Unit Testing Strategy

**Framework**: Jest + React Testing Library

**Coverage Areas**:
1. **Rendering**: Each variant renders correctly
2. **Interactions**: Click, keyboard, focus events
3. **Accessibility**: ARIA attributes, keyboard navigation
4. **Edge Cases**: Empty strings, undefined props, extreme values
5. **Integration**: Subcomponents work together (Card, Modal)

**Example Unit Tests**:
```typescript
describe("Button", () => {
  it("renders primary variant with correct styles", () => {
    render(<Button variant="primary">Click me</Button>)
    expect(screen.getByRole("button")).toHaveClass("bg-yellow-500")
  })
  
  it("disables interaction when loading", () => {
    render(<Button loading>Click me</Button>)
    expect(screen.getByRole("button")).toBeDisabled()
  })
  
  it("handles keyboard navigation", () => {
    const onClick = jest.fn()
    render(<Button onClick={onClick}>Click me</Button>)
    fireEvent.keyDown(screen.getByRole("button"), { key: "Enter" })
    expect(onClick).toHaveBeenCalled()
  })
})
```

### Visual Regression Testing

**Tool**: Storybook with Chromatic (future enhancement)

**Coverage**: Each component variant captured as visual snapshot

### Accessibility Testing

**Tools**:
- jest-axe for automated accessibility checks
- Manual testing with screen readers (NVDA, VoiceOver)
- Keyboard-only navigation testing

**Example**:
```typescript
import { axe } from "jest-axe"

it("has no accessibility violations", async () => {
  const { container } = render(<Button>Click me</Button>)
  const results = await axe(container)
  expect(results).toHaveNoViolations()
})
```

### Integration Testing

**Scope**: Test component combinations in realistic scenarios

**Example**:
```typescript
describe("Modal with Form", () => {
  it("submits form and closes modal", async () => {
    const onSubmit = jest.fn()
    render(
      <Modal open onClose={jest.fn()}>
        <ModalTitle>Edit Profile</ModalTitle>
        <ModalBody>
          <Input label="Name" />
        </ModalBody>
        <ModalFooter>
          <Button onClick={onSubmit}>Save</Button>
        </ModalFooter>
      </Modal>
    )
    
    await userEvent.type(screen.getByLabelText("Name"), "John Doe")
    await userEvent.click(screen.getByText("Save"))
    expect(onSubmit).toHaveBeenCalled()
  })
})
```

### Test Organization

```
__tests__/
├── unit/
│   ├── button.test.tsx
│   ├── card.test.tsx
│   ├── input.test.tsx
│   └── ...
├── properties/
│   ├── cn.property.test.ts
│   ├── avatar.property.test.ts
│   └── ...
└── integration/
    ├── modal-form.test.tsx
    └── nav-mobile.test.tsx
```

