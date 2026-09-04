# Monai Application Design System Plan

## Status

Proposed

## Design Read

Monai is a Persian-first personal finance application for privacy-conscious users. Its visual language is clean, minimal, and trust-first, using customized shadcn/ui components, Tailwind CSS v4, Vazirmatn, and Hugeicons.

Monai is product UI, not a landing page. Product workflows, financial accuracy, accessibility, and responsive behavior take priority over marketing-page composition patterns.

## Design Dials

- `DESIGN_VARIANCE: 4`
- `MOTION_INTENSITY: 3`
- `VISUAL_DENSITY: 5`

These values establish a predictable structure, restrained functional motion, and enough information density for daily financial use without making the interface feel crowded.

## Design Principles

- Functionality and clarity take priority over decoration.
- Mobile should behave like an installed native application, not a responsive webpage.
- Desktop should use a full two-pane workspace with navigation and content side by side.
- Financially critical values must be visually dominant and easy to verify.
- Persian and RTL behavior must be structural, not added through local overrides.
- One customized shadcn/ui component system is used throughout.
- Hugeicons is the only icon family.
- Every async workflow includes loading, success, empty, error, permission-denied, offline, and rate-limited states.
- Motion communicates feedback or state changes only.
- Light and dark themes use the same semantic token contracts.

## Responsive Application Shell

### Mobile Shell

Monai should behave like an installed native mobile application:

- Use a full viewport shell with `min-height: 100dvh`.
- Respect `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)`.
- Use a sticky app bar approximately 56px high.
- Use fixed bottom navigation approximately 64px high plus safe-area padding.
- Keep the active section mounted when practical to preserve scroll position.
- Close sheets and dialogs before navigating backward out of the current section.
- Ensure primary controls have a minimum 48px touch height.
- Do not depend on hover for any essential action.
- Use bottom sheets or full-screen mobile pages for capture, manual entry, filters, and transaction details.
- Avoid webpage-style breadcrumbs, oversized page headings, and desktop cards compressed onto mobile.
- Keep the focused input and primary action visible when the mobile keyboard opens.

Primary destinations, ordered for RTL, are:

- `خانه`
- `تراکنش‌ها`
- `تکمیل اطلاعات`
- `گفت‌وگو`
- `تنظیمات`

The first destination appears on the right side of the bottom navigation. `تکمیل اطلاعات` displays a semantic badge containing the unresolved draft count.

A prominent capture action opens:

- `خواندن از کلیپ‌بورد`
- `ثبت دستی تراکنش`

### Desktop Shell

Desktop uses a full two-pane application layout:

```text
┌──────────────────┬──────────────────────────────────────┐
│ Navigation       │ Active workspace                     │
│ RTL: right side  │ RTL content                          │
│                  │                                      │
│ Home             │ Page header                          │
│ Transactions     │ Main content                         │
│ Enrichment       │                                      │
│ Chat             │                                      │
│ Settings         │                                      │
│                  │                                      │
│ Capture action   │                                      │
└──────────────────┴──────────────────────────────────────┘
```

Specifications:

- Place the navigation pane on the right for RTL.
- Use a 248px normal navigation width and an 80px collapsed width.
- Keep the sidebar fixed while the content pane scrolls.
- Keep the capture action visible near the bottom of the navigation pane.
- Let the content pane occupy the remaining viewport width.
- Do not impose a page-level marketing-site max width on the application shell.
- Collapse the sidebar between approximately 768px and 1100px.
- Below 768px, switch completely to the mobile shell.
- Avoid a permanent third application pane.
- Use dialogs, sheets, or an internal content split for transaction details and enrichment review when sufficient width exists.

Individual workspaces use internal width constraints:

| Workspace | Content width |
|---|---:|
| Chat transcript | 760-840px |
| Manual transaction form | 640-720px |
| Transaction list | Up to 1120px |
| Enrichment review | Up to 960px |

## Token Architecture

Use three explicit token layers:

```text
Primitive tokens
    ↓
Semantic tokens
    ↓
Component tokens
```

Recommended structure:

```text
app/src/styles/
  tokens/
    primitives.css
    semantic.css
    components.css
    index.css
```

Components must not use primitive tokens directly. Semantic tokens provide theme switching. Component tokens provide stable contracts for reusable UI.

### Primitive Tokens

Primitive tokens contain raw design values only:

- Neutral zinc scale.
- Cobalt-blue primary scale.
- Emerald income scale.
- Rose expense and destructive scale.
- Amber warning scale.
- A 4px spacing scale.
- Vazirmatn typography values.
- One soft radius family.
- A restrained elevation scale.
- Interaction durations.

Example shape:

```css
:root {
  --primitive-color-zinc-50: 0 0% 98%;
  --primitive-color-zinc-950: 240 10% 4%;

  --primitive-color-cobalt-600: 221 83% 53%;
  --primitive-color-emerald-600: 160 84% 39%;
  --primitive-color-rose-600: 347 77% 50%;
  --primitive-color-amber-500: 38 92% 50%;

  --primitive-space-1: 0.25rem;
  --primitive-space-2: 0.5rem;
  --primitive-space-3: 0.75rem;
  --primitive-space-4: 1rem;
  --primitive-space-6: 1.5rem;
  --primitive-space-8: 2rem;

  --primitive-radius-sm: 0.5rem;
  --primitive-radius-md: 0.75rem;
  --primitive-radius-lg: 1rem;

  --primitive-duration-fast: 120ms;
  --primitive-duration-normal: 180ms;
  --primitive-duration-slow: 260ms;
}
```

Final color values must be contrast-tested before implementation.

### Semantic Tokens

Semantic tokens map raw values to purpose:

```css
:root {
  --background: var(--primitive-color-zinc-50);
  --foreground: var(--primitive-color-zinc-950);

  --surface: ...;
  --surface-elevated: ...;
  --surface-muted: ...;

  --primary: var(--primitive-color-cobalt-600);
  --primary-foreground: ...;
  --primary-hover: ...;
  --primary-active: ...;

  --border: ...;
  --border-strong: ...;
  --ring: var(--primitive-color-cobalt-600);

  --income: var(--primitive-color-emerald-600);
  --expense: var(--primitive-color-rose-600);
  --warning: var(--primitive-color-amber-500);
  --destructive: var(--primitive-color-rose-600);

  --text-primary: ...;
  --text-secondary: ...;
  --text-disabled: ...;
}
```

Income, expense, warning, and destructive colors are semantic signals, not additional brand accents. Pair every semantic color with text and a Hugeicon so meaning never depends on color alone.

Dark mode overrides semantic tokens only. Primitive and component layers remain stable.

### Component Tokens

Component tokens define stable dimensions and behavior:

```css
:root {
  --app-bar-height: 3.5rem;
  --bottom-nav-height: 4rem;
  --sidebar-width: 15.5rem;
  --sidebar-width-collapsed: 5rem;

  --button-height-sm: 2.25rem;
  --button-height-default: 2.75rem;
  --button-height-touch: 3rem;

  --input-height-default: 3rem;
  --input-radius: var(--primitive-radius-md);

  --sheet-radius-mobile: var(--primitive-radius-lg);
  --transaction-row-min-height: 4.5rem;
  --chat-composer-min-height: 3rem;
}
```

## Typography

Use Vazirmatn as the only application type family. Self-host it and set `font-display: swap`.

| Role | Mobile | Desktop | Weight |
|---|---:|---:|---:|
| Page title | 24px | 28px | 700 |
| Section title | 18px | 20px | 600 |
| Body | 15px | 16px | 400 |
| Label | 14px | 14px | 500 |
| Supporting text | 13px | 13px | 400 |
| Financial amount | 24-32px | 28-36px | 700 |
| Navigation | 12px | 14px | 500 |

Requirements:

- Use Persian numerals in visible financial values.
- Use tabular numerals where supported or align numeric columns explicitly.
- Isolate account numbers, card numbers, IBANs, URLs, and technical identifiers with LTR direction.
- Do not reduce supporting text below 12px.
- Avoid wide tracking in Persian text.
- Keep the monetary unit visually subordinate to the amount.

## Component System

Use shadcn/ui as owned component source code, not as an unmodified visual theme.

Initial components:

- Button
- Input
- Textarea
- Select
- Radio Group
- Checkbox
- Switch
- Dialog
- Drawer
- Sheet
- Alert Dialog
- Tabs
- Badge
- Skeleton
- Toast
- Dropdown Menu
- Calendar
- Form
- Scroll Area
- Separator
- Tooltip
- Command, only when transaction or category search requires it

Customize shadcn globally through semantic and component tokens. Do not restyle each instance independently.

### Hugeicons

Install:

```bash
npm install @hugeicons/react @hugeicons/core-free-icons
```

Use one wrapper:

```tsx
<HugeiconsIcon
  icon={Home01Icon}
  size={24}
  color="currentColor"
  strokeWidth={1.5}
/>
```

Rules:

- Use only Hugeicons.
- Standardize icon stroke width at `1.5`.
- Use 24px navigation icons on mobile and 20px on desktop.
- Use 18-20px inline icons.
- Use 32-40px empty-state icons.
- Do not mix Hugeicons with Lucide or hand-authored SVG paths.
- Replace icon imports generated by shadcn with the Hugeicons wrapper.
- Mirror or replace directional icons as required for RTL.
- Verify exact icon export names against the installed free-icon package during implementation.

## Core Component Specifications

### Primary Button

- Mobile height: 48px.
- Desktop height: 44px.
- Radius: 12px.
- Label must remain on one line.
- Support default, hover, active, focus-visible, loading, and disabled states.
- Loading must preserve the button width.
- Active feedback uses `scale(0.98)`.
- Focus uses a 2px ring with a 2px offset.
- Button text must meet WCAG AA contrast.

### Form Field

Anatomy:

```text
Label
Input
Helper or error message
```

Requirements:

- Never use a placeholder as the label.
- Keep errors below their fields.
- Apply `aria-invalid` and `aria-describedby` when invalid.
- Accept Persian, Arabic, and Latin digits in financial amount inputs.
- Expose the display unit explicitly as Toman or Rial.
- Avoid disruptive normalization while the user is typing.
- Preserve the typed value during validation failure.

### Transaction Row

Display:

- Transaction-kind icon and readable label.
- Description or category.
- Persian amount in Toman.
- Jalali date and time.
- Account or bank.
- Verification state when applicable.

States:

- Default
- Pressed
- Selected
- Pending review
- Duplicate warning
- Parse failure
- Loading skeleton

Income and expense use an icon and label in addition to semantic color.

### Enrichment Item

Show critical fields first:

- Amount
- Currency
- Financial kind
- Date
- Account

Optional enrichment follows:

- Category
- Note
- Counterparty

`مشاهده پیام اصلی` is a disclosure, not a permanently expanded card.

### Chat Composer

- Place it above the mobile bottom navigation and safe area.
- On desktop, anchor it to the bottom of the content pane.
- Grow until a defined maximum height, then scroll internally.
- Accept questions only.
- Detect receipt-like content and redirect to Capture.
- Keep the send control reachable while the keyboard is open.
- Preserve unsent text during temporary network failures.

## Interaction States

Every asynchronous surface includes:

- Initial
- Loading
- Success
- Empty
- Inline error
- Permission denied
- Offline
- Rate limited

Capture adds:

- Clipboard empty
- Clipboard permission denied
- Not a transaction
- Sensitive or OTP blocked
- Duplicate
- Parse failed
- Draft created

Enrichment adds:

- No pending drafts
- Unsaved changes
- Saving
- Verified
- Rejected
- Conflict caused by another session

State priority, highest first:

1. Disabled
2. Loading
3. Active
4. Focus
5. Hover
6. Default

Never rely on color alone for a state. Use text, icons, and ARIA attributes.

## Motion

Motion is functional only:

- Bottom sheet opening and closing.
- Primary navigation state changes.
- Draft insertion into Enrichment.
- Save and verification confirmation.
- Skeleton shimmer.
- Dialog and toast transitions.

Specifications:

- Use durations between 120ms and 260ms.
- Animate transform and opacity only.
- Avoid perpetual floating, decorative gradients, parallax, marquees, magnetic controls, and scroll hijacking.
- Respect `prefers-reduced-motion`; collapse transitions to instant changes or simple opacity.

## PWA Native Behavior

Plan for:

- `display: standalone`.
- Persian `name`, `short_name`, `lang`, and `dir` in the web manifest.
- Light and dark `theme_color` values.
- Maskable application icons.
- App-shell caching through a service worker.
- A dedicated offline screen with retry.
- No caching of private API responses unless encryption and retention are explicitly justified.
- Platform-specific installation guidance for iOS and Android.
- Clipboard access initiated only by a direct user action.
- Mobile keyboard and safe-area testing on Safari and Chrome.
- Standalone-mode testing after installation on both platforms.

## Tailwind CSS v4 Integration

Use the Vite plugin and CSS-first configuration:

```css
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));
```

Expose semantic variables to Tailwind utilities with `@theme`. Do not use the legacy Tailwind PostCSS plugin or a Tailwind v3 configuration pattern.

For `components.json`:

- `style: "new-york"`
- `rsc: false`
- `tsx: true`
- `tailwind.config: ""`
- `tailwind.cssVariables: true`
- Vite aliases using `@/`
- Generated icon imports replaced by Hugeicons

Use logical utilities throughout:

- `ps-*` and `pe-*`
- `ms-*` and `me-*`
- `start-*` and `end-*`
- `text-start`

Avoid direction-specific `left-*`, `right-*`, `pl-*`, and `pr-*` unless an element has a genuinely physical placement that should not mirror in RTL.

## File Structure

Recommended frontend structure:

```text
app/src/
  components/
    app-shell/
      mobile-shell.tsx
      desktop-shell.tsx
      app-header.tsx
      bottom-navigation.tsx
      desktop-navigation.tsx
    capture/
    enrichment/
    transactions/
    chat/
    settings/
    ui/
  hooks/
  lib/
    currency.ts
    dates.ts
    digits.ts
    direction.ts
  styles/
    tokens/
      primitives.css
      semantic.css
      components.css
      index.css
  App.tsx
  main.tsx
```

## Implementation Phases

### Establish Tokens

- Define primitive color, spacing, radius, typography, elevation, and duration tokens.
- Define semantic light and dark themes.
- Define app-shell and core-component tokens.
- Add token generation and hardcoded-value validation scripts.
- Validate color contrast before component implementation.

### Establish Foundations

- Configure Tailwind CSS v4 with the Vite plugin.
- Configure shadcn/ui for Vite and CSS variables.
- Add self-hosted Vazirmatn.
- Add Hugeicons and the shared icon wrapper.
- Set `lang="fa"` and `dir="rtl"` at the document root.
- Add theme initialization based on system preference.

### Build Application Shells

- Build the mobile native shell with safe areas and bottom navigation.
- Build the desktop two-pane shell with fixed navigation.
- Implement the collapsed desktop navigation state.
- Switch shells at the 768px breakpoint.
- Preserve section scroll positions.
- Verify keyboard and hardware-back behavior.

### Build Core Components

- Customize shadcn Button, Input, Textarea, Select, Sheet, Dialog, Badge, Skeleton, Toast, Form, and Calendar.
- Implement transaction rows, enrichment items, amount inputs, and the chat composer.
- Implement all loading, empty, error, permission, offline, and rate-limited states.
- Add accessible focus, ARIA, and keyboard behavior.

### Add PWA Behavior

- Add the manifest and application icons.
- Add app-shell caching and the offline screen.
- Add platform-specific installation guidance.
- Test standalone mode, safe areas, keyboard handling, and clipboard permissions.

### Validate and Harden

- Add token validation to CI.
- Add light and dark visual-regression tests.
- Add responsive tests at mobile, tablet, collapsed desktop, and full desktop widths.
- Run accessibility checks and keyboard-only walkthroughs.
- Run Lighthouse and verify Core Web Vitals.

## Test Strategy

### Token Tests

- Every semantic token resolves to a primitive token.
- Every component token resolves to a semantic or primitive scale token.
- Components contain no raw color values.
- Components avoid hardcoded spacing when a token exists.
- Light and dark themes expose the same semantic token names.

### Component Tests

- Buttons support default, active, focus, loading, and disabled states.
- Form errors are announced and connected to their fields.
- Transaction meaning never depends on color alone.
- Sheets and dialogs trap focus and restore it on close.
- Chat preserves unsent input after network failure.
- Clipboard denial produces a manual paste fallback.

### Responsive Tests

- Mobile uses bottom navigation and no desktop sidebar.
- Desktop uses a right-side navigation pane and no mobile bottom navigation.
- The sidebar collapses at the intended intermediate width.
- Safe-area padding works in installed iOS and Android modes.
- The mobile keyboard does not hide primary controls.
- Content panes do not introduce unintended horizontal scrolling.

### Visual Tests

- Light and dark themes maintain equivalent hierarchy.
- Primary, income, expense, warning, and destructive states pass contrast requirements.
- Persian labels do not wrap unexpectedly.
- Amounts and units remain correctly aligned.
- Hugeicons use one family and one stroke width.

## Acceptance Criteria

- Mobile feels like a native installed application rather than a webpage.
- Desktop uses a full two-pane RTL layout with navigation on the right.
- The application switches completely between mobile and desktop shells below 768px.
- All layout decisions respect RTL using logical properties.
- The interface uses Vazirmatn exclusively.
- shadcn/ui is the only component foundation and is customized through tokens.
- Hugeicons is the only icon family, with a standard `1.5` stroke width.
- The design system uses primitive, semantic, and component token layers.
- Components do not contain raw colors where semantic tokens exist.
- Light and dark themes use the same semantic contracts.
- All primary mobile controls meet the 48px touch-target requirement.
- All interactive components have loading, disabled, focus, and error states where applicable.
- Financial states use labels and icons in addition to color.
- PWA standalone mode respects safe areas and the mobile keyboard.
- Private API responses are not cached by the service worker.
- Motion is functional, restrained, and reduced-motion compatible.
- Core forms and navigation pass keyboard and screen-reader checks.
- Token validation and responsive visual regression run in CI.

## Dependency Decisions

Use:

- React and TypeScript.
- Vite.
- Tailwind CSS v4 with `@tailwindcss/vite`.
- shadcn/ui with CSS variables and owned component source.
- Radix primitives only through shadcn components unless a concrete gap exists.
- `@hugeicons/react` and `@hugeicons/core-free-icons`.
- Self-hosted Vazirmatn.

Do not add:

- A second component design system.
- Lucide alongside Hugeicons.
- Decorative animation libraries without a defined product need.
- A separate styling framework alongside Tailwind.
- Raw hardcoded theme colors inside components.
