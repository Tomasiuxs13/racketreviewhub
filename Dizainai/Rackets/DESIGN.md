# Design System Document

## 1. Overview & Creative North Star
**Creative North Star: The Elite Performance Editorial**

This design system is engineered to elevate Padel racket reviews from a standard e-commerce grid to a high-end, data-driven editorial experience. It is designed for the "Pro-Player" mindset—where performance metrics are as vital as aesthetic prestige. 

To break the "template" look common in sports retail, we utilize **intentional asymmetry** and **tonal depth**. The layout relies on "breathing room" (generous whitespace) and a rigid typographic hierarchy to establish authority. Instead of using lines to separate ideas, we use layering and shifts in surface temperature, creating an interface that feels like a premium digital magazine tailored for the modern athlete.

---

## 2. Colors

The palette moves beyond basic green and white, introducing deep slate and navy tones to provide a "pro-studio" atmosphere.

### Color Tokens
*   **Primary (`#006C49`):** The deep anchor. Used for high-level brand moments.
*   **Primary-Container (`#10B981`):** The signature Padel green. Reserved exclusively for "Action" moments—CTAs, price highlights, and "In Stock" indicators.
*   **Surface Palette:** 
    *   `surface-container-lowest`: `#FFFFFF` (Main card backgrounds)
    *   `surface-low`: `#F0F3FF` (Secondary section backgrounds)
    *   `surface`: `#F9F9FF` (The global canvas)
    *   `inverse-surface`: `#2A313D` (Deep navy for footers and high-contrast headers)

### Strategic Application
*   **The "No-Line" Rule:** 1px solid borders are strictly prohibited for sectioning. Contrast must be achieved through background shifts. For example, a racket's technical specs section should use `surface-container-low` to sit naturally atop the `surface` background.
*   **Glass & Gradient Rule:** Use Backdrop Blurs (12px–20px) on navigation bars and floating comparison tools. Apply a subtle linear gradient (Top-Left to Bottom-Right) from `primary` to `primary-container` on primary buttons to give them a tactile, "weighted" feel.
*   **Signature Textures:** For hero sections, use a radial gradient transitioning from `surface-bright` to `surface-variant` to mimic professional studio lighting.

---

## 3. Typography

The typography strategy pairs the precision of **Inter** with a highly structured scale to guide the reader through complex technical data.

*   **Display (Display-LG/MD):** Used for "Power Headlines" (e.g., "Find Your Perfect Racket"). These should be set with tight tracking (-0.02em) to feel bold and aggressive.
*   **Headlines (Headline-LG/MD):** Used for product names. The font weight should be 800 (Extra Bold) to command attention against the clean white space.
*   **Body (Body-LG/MD):** Inter at 400 weight. Line height is set to 1.6 for maximum readability during long-form reviews.
*   **Labels (Label-MD/SM):** All-caps with increased letter spacing (+0.05em) for technical specs (e.g., "WEIGHT," "BALANCE," "CORE"). This conveys a "data-heavy" professional instrument feel.

---

## 4. Elevation & Depth

Hierarchy is achieved through **Tonal Layering** rather than shadows.

*   **The Layering Principle:** Treat the UI as physical layers.
    *   *Level 0:* `surface` (The floor)
    *   *Level 1:* `surface-container-low` (Content groupings)
    *   *Level 2:* `surface-container-lowest` (Interactive cards/modals)
*   **Ambient Shadows:** If a card requires a "lift" (e.g., on hover), use a shadow tinted with the `on-surface` color: `box-shadow: 0 12px 32px -4px rgba(21, 28, 39, 0.06)`. It should feel like air, not ink.
*   **The "Ghost Border" Fallback:** For input fields or where separation is critical for accessibility, use the `outline-variant` token at **15% opacity**.
*   **Glassmorphism:** Navigation menus should use a 70% opacity version of `surface` with a `backdrop-filter: blur(12px)`. This integrates the UI with the high-quality racket photography beneath it.

---

## 5. Components

### Buttons
*   **Primary:** Background: Gradient (`primary` to `primary-container`); Text: `on-primary`; Radius: `md` (0.375rem).
*   **Secondary:** Background: `surface-container-highest`; Text: `on-surface`; No border.
*   **Tertiary:** Transparent background; Text: `primary`; Bold weight.

### Racket Data Cards
*   **Layout:** No borders. Use `surface-container-lowest` as the card base. 
*   **Visuals:** Racket imagery must be centered with a subtle `surface-variant` soft-glow behind the product to create depth.
*   **Data Bars:** Use `primary-container` for the filled state of performance bars (Power, Control) and `surface-variant` for the empty state. 

### Comparison Chips
*   **Style:** Pill-shaped (`full` roundedness). 
*   **State:** Unselected chips use `surface-low` with `on-surface-variant` text. Selected chips use `primary` with `on-primary` text.

### Technical Spec Lists
*   **Rule:** Forbid the use of divider lines. 
*   **Pattern:** Use zebra-striping with `surface-container-low` on every second row or utilize `spacing-3` (1rem) of vertical whitespace to denote separation.

---

## 6. Do's and Don'ts

### Do
*   **DO** use asymmetric imagery—allow rackets to "break the container" and overlap slightly into the next section to create movement.
*   **DO** use "Primary-Fixed" (`#6FFBBE`) for small accents like "New 2025" badges to ensure they pop without overwhelming the slate palette.
*   **DO** prioritize high-contrast typography for ratings (e.g., the large "94" score should be the most prominent element on a card).

### Don't
*   **DON'T** use 100% black (`#000000`) for body text. Use `on-surface` (`#151C27`) for a softer, more premium feel.
*   **DON'T** use standard "drop shadows" on images. Let the clean, high-resolution photography speak for itself against the tonal background.
*   **DON'T** use "Primary Container" green for everything. If it's not a button, a success state, or a key rating, it should likely be slate or gray.