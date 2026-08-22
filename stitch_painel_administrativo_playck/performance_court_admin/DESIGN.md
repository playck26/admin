---
name: Performance Court Admin
colors:
  surface: '#f4fcef'
  surface-dim: '#d5dcd1'
  surface-bright: '#f4fcef'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eef6ea'
  surface-container: '#e9f0e4'
  surface-container-high: '#e3eade'
  surface-container-highest: '#dde5d9'
  on-surface: '#161d16'
  on-surface-variant: '#3e4a3d'
  inverse-surface: '#2b322a'
  inverse-on-surface: '#ecf3e7'
  outline: '#6e7b6c'
  outline-variant: '#bdcab9'
  surface-tint: '#006e2a'
  primary: '#006b29'
  on-primary: '#ffffff'
  primary-container: '#008735'
  on-primary-container: '#f7fff2'
  inverse-primary: '#61df78'
  secondary: '#006c51'
  on-secondary: '#ffffff'
  secondary-container: '#66f8c7'
  on-secondary-container: '#007054'
  tertiary: '#ba0030'
  on-tertiary: '#ffffff'
  tertiary-container: '#e9003f'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#7efc92'
  primary-fixed-dim: '#61df78'
  on-primary-fixed: '#002108'
  on-primary-fixed-variant: '#00531e'
  secondary-fixed: '#69fbca'
  secondary-fixed-dim: '#47deaf'
  on-secondary-fixed: '#002116'
  on-secondary-fixed-variant: '#00513c'
  tertiary-fixed: '#ffdad9'
  tertiary-fixed-dim: '#ffb3b4'
  on-tertiary-fixed: '#40000a'
  on-tertiary-fixed-variant: '#920024'
  background: '#f4fcef'
  on-background: '#161d16'
  surface-variant: '#dde5d9'
typography:
  page-title:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.02em
  section-title:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 16px
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  sidebar-width: 250px
  container-margin: 2rem
  gutter: 1.5rem
  stack-sm: 0.5rem
  stack-md: 1rem
  stack-lg: 1.5rem
---

## Brand & Style

This design system is built for an administrative environment that demands high legibility, professional reliability, and a strong connection to the physical world of sports (specifically tennis/paddle courts). The brand personality is athletic, disciplined, and energetic.

The visual style follows a **Corporate / Modern** aesthetic with **Tactile** undertones. It utilizes a warm off-white foundation to reduce eye strain during long administrative sessions, paired with vibrant greens that evoke the spirit of the court. UI elements feature soft, non-flat shadows to provide depth and clear visual hierarchy without the harshness of high-contrast brutalism. The interface should feel organized, "grippy," and highly functional.

## Colors

The palette is anchored by "Court Green," providing a thematic link to the sport. 

- **Primary Green (#009C3F):** Used for active states, links, and success indicators.
- **Dark Green (#00763A):** Reserved for primary action buttons to ensure high contrast with white text and a sense of "solid ground."
- **Teal Secondary (#00BD90):** Used for supportive actions and specialized badges to differentiate from the primary brand green.
- **Red Tertiary (#ED0040):** High-visibility red for destructive actions and critical alerts.
- **Neutrals:** The background is a warm, organic off-white (#F7F8F5) to feel more "outdoor-natural" than sterile blue-grays. Text uses a deep forest-black (#12160F) to maintain professional contrast.

## Typography

The design system utilizes **Inter** for its exceptional legibility in data-heavy environments. 

- **Hierarchy:** Use `page-title` only for top-level headers (e.g., "Dashboard"). `section-title` is used for card headers and sidebar groupings.
- **Tables:** Use `body-sm` for standard table rows to maximize data density while maintaining scannability.
- **Captions:** Use `label-sm` for help text under inputs or secondary metadata in lists.
- **Emphasis:** Use Semibold (600) rather than Bold (700) for internal UI elements to prevent the interface from feeling "heavy."

## Layout & Spacing

The layout uses a **Fixed Sidebar + Fluid Content** model. 

- **Sidebar:** A permanent 250px vertical navigation bar on the left.
- **Grid:** Content is housed within a fluid container with a 2rem margin. 
- **Rhythm:** A base-4 unit system is used (4px, 8px, 16px, 24px, 32px).
- **Mobile Adaptation:** On mobile devices, the sidebar collapses into a bottom navigation bar or a hamburger menu, and container margins reduce to 1rem. Cards should reflow to a single column.

## Elevation & Depth

This design system uses a "Layered Surface" approach to create hierarchy:

1.  **Level 0 (Background):** #F7F8F5. The foundation.
2.  **Level 1 (Cards/Tables):** #FFFFFF. These surfaces use a "Soft Shadow" (Hex #12160F at 5% opacity, 8px blur, 4px Y-offset). This makes the white surface pop against the off-white background without feeling disconnected.
3.  **Level 2 (Modals/Overlays):** #FFFFFF. More pronounced shadow (12% opacity, 16px blur, 8px Y-offset) to indicate a higher Z-index.

Avoid harsh black shadows; always tint shadows with the Primary Text color to maintain the warm, organic feel.

## Shapes

The shape language balances approachability with professional structure:

- **Action Elements:** Buttons, input fields, and badges use an 8px (`rounded-md`) radius.
- **Containers:** Main cards and content wrappers use a 16px (`rounded-lg`) radius to create a distinct frame for content.
- **Interactive States:** Hovering over a list item or sidebar link should reveal a 4px or 8px rounded background highlight.

## Components

### Buttons
- **Primary:** Dark Green (#00763A) background, White text. No border.
- **Secondary (Outline):** Transparent background, 1.5px border of Primary Green (#009C3F).
- **Destructive (Outline):** Transparent background, 1.5px border of Red (#ED0040), Red text.

### Badges (Status Indicators)
- **General:** Small, 8px radius, bold uppercase text at 11px.
- **Ativo / Pago:** Light Green background (15% opacity of #009C3F), Primary Green text.
- **Pendente:** Light Amber background (15% opacity of #B8862E), Warning text.
- **Inativo:** Light Gray background, Secondary Text color.

### Tables
- **Styling:** No outer border on the table container. Rows should have a 1px solid border-bottom (#EAECE6).
- **Interaction:** Hover state on rows should change the background to a very light green tint or a slightly darker off-white to assist eye-tracking.

### Sidebar
- **Navigation:** Vertical stack. Icons should be used for each item (Dashboard, Alunos, etc.). Active state is indicated by a Primary Green (#009C3F) left-edge "pill" (4px width) and the text switching to Primary Green.

### Inputs
- **Style:** 8px radius, #FFFFFF background, 1px border (#EAECE6). On focus, the border transitions to Primary Green with a 2px soft outer glow.