---
name: Premium Editorial Finance
colors:
  surface: '#fdf8f8'
  surface-dim: '#ddd9d8'
  surface-bright: '#fdf8f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f7f3f2'
  surface-container: '#f1edec'
  surface-container-high: '#ebe7e6'
  surface-container-highest: '#e5e2e1'
  on-surface: '#1c1b1b'
  on-surface-variant: '#444748'
  inverse-surface: '#313030'
  inverse-on-surface: '#f4f0ef'
  outline: '#747878'
  outline-variant: '#c4c7c7'
  surface-tint: '#5f5e5e'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1c1b1b'
  on-primary-container: '#858383'
  inverse-primary: '#c8c6c5'
  secondary: '#5e5e5e'
  on-secondary: '#ffffff'
  secondary-container: '#e3e2e2'
  on-secondary-container: '#646464'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#0f0069'
  on-tertiary-container: '#7671ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e5e2e1'
  primary-fixed-dim: '#c8c6c5'
  on-primary-fixed: '#1c1b1b'
  on-primary-fixed-variant: '#474746'
  secondary-fixed: '#e3e2e2'
  secondary-fixed-dim: '#c7c6c6'
  on-secondary-fixed: '#1b1c1c'
  on-secondary-fixed-variant: '#464747'
  tertiary-fixed: '#e2dfff'
  tertiary-fixed-dim: '#c3c0ff'
  on-tertiary-fixed: '#0f0069'
  on-tertiary-fixed-variant: '#3323cc'
  background: '#fdf8f8'
  on-background: '#1c1b1b'
  surface-variant: '#e5e2e1'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 72px
    fontWeight: '200'
    lineHeight: 80px
    letterSpacing: -0.04em
  display-md:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '300'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '500'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '500'
    lineHeight: 34px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-padding: 24px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
  gutter: 16px
---

## Brand & Style

This design system is built on the principles of **Swiss-inspired Minimalism**, emphasizing clarity, typographic hierarchy, and intentional whitespace. It is designed for a premium financial experience that feels more like an editorial publication than a traditional utility app.

The brand personality is **sophisticated, precise, and calm**. It avoids the "gamified" aesthetics common in fintech, opting instead for a "Zen-like" focus on data. The emotional goal is to evoke a sense of control and clarity through an "iOS-quality" execution—prioritizing high-end finishes, subtle borders, and a restricted color palette that allows financial figures to take center stage.

## Colors

The palette is anchored by a warm, off-white background that reduces eye strain and provides a soft canvas for sharp, near-black typography.

- **Primary & Secondary:** Near-black (#1A1A1A) is used for all high-priority information and primary actions. Medium gray (#757575) is reserved for metadata and secondary labels to create depth.
- **Accents:** A single indigo accent (#4F46E5) is used sparingly for active states, notifications, or primary CTA buttons.
- **Functional:** Muted green and red are utilized strictly for financial directional data (income vs. expenses), ensuring they remain professional rather than alarming.
- **Borders:** Soft gray (#E5E5E5) is the primary structural tool, replacing shadows to define edges and containers.

## Typography

Typography is the most critical asset in this design system. We use **Inter** for its neutral, highly legible character and exceptional numerical tabular figures.

- **Financial Figures:** Use `display-lg` and `display-md` with a light weight (200-300) for hero balances. This emulates the look of luxury timepieces and editorial layouts.
- **Negative Space:** Maintain generous line heights to ensure large blocks of text or lists feel airy.
- **Optical Adjustments:** High-level headers use negative letter-spacing to appear more cohesive, while small labels use slight positive tracking and uppercase styling for increased scan-readability.

## Layout & Spacing

The layout is governed by a **strict 8px grid system** with an emphasis on vertical rhythm. 

- **Mobile Viewport:** Utilize a 24px side margin for primary content containers to create a "framed" editorial feel.
- **Stacking:** Use 32px or 48px of vertical space between major sections to reinforce the premium, unhurried brand personality. 
- **Grouping:** Related elements (like a label and its input) should be separated by 8px, while distinct groups should be separated by 24px.
- **Alignment:** All text and icons must be strictly baseline-aligned to the grid to maintain Swiss precision.

## Elevation & Depth

This system avoids traditional shadows in favor of **Tonal Layering and Borders**.

- **Containers:** Depth is created by placing white (#FFFFFF) cards on the off-white (#F9F9F8) background.
- **Outlines:** A 1px solid border (#E5E5E5) is the primary method for defining card boundaries. 
- **Subtle Shadows:** If a shadow is required for a floating element (like a bottom sheet), use an extremely diffused, low-opacity neutral shadow: `0px 4px 20px rgba(0, 0, 0, 0.03)`. 
- **Active State:** Depth for active items is indicated by a subtle fill change or the indigo primary color, never through "lifting" the element via shadow.

## Shapes

The shape language is defined by large, inviting radii that contrast with the sharp, minimal typography.

- **Primary Cards:** Use a 24px or 28px corner radius (`rounded-xl` / `rounded-2xl`). This softens the "industrial" feel of a finance app.
- **Buttons & Inputs:** Consistent 12px to 16px radius.
- **Interaction Feedback:** Hover or press states should follow the corner radius of the parent container exactly.
- **Iconography:** Icons should be 2px stroke weight with slightly rounded terminals to match the font weight of Inter.

## Components

- **Buttons:** Primary buttons are solid near-black with white text. Secondary buttons are transparent with a 1px soft-gray border. No gradients.
- **Cards:** White background, 1px border (#E5E5E5), 24px padding. Content within cards should follow the 8px grid.
- **Input Fields:** Minimalist design—bottom-border only or a very light 1px surrounding border. Focus states are indicated by the indigo accent color.
- **Chips/Badges:** Small, 12px radius, light-gray background with medium-gray text for metadata; use muted green/red for status indicators.
- **Lists:** Clean rows with 1px hairline dividers. Dividers should have a 24px left inset to align with text rather than the edge of the screen.
- **Charts:** Use thin, 2px lines for trends. Avoid fills under the line unless it is a very low-opacity (5%) monochromatic tint.