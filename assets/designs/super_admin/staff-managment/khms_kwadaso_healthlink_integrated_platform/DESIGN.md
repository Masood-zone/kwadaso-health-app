---
name: KHIP — Kwadaso HealthLink Integrated Platform
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#40493c'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#707a6b'
  outline-variant: '#c0cab8'
  surface-tint: '#206d1b'
  primary: '#004302'
  on-primary: '#ffffff'
  primary-container: '#0b5d0b'
  on-primary-container: '#86d576'
  inverse-primary: '#8ad97a'
  secondary: '#bb0021'
  on-secondary: '#ffffff'
  secondary-container: '#ea002c'
  on-secondary-container: '#fffbff'
  tertiary: '#572e00'
  on-tertiary: '#ffffff'
  tertiary-container: '#784200'
  on-tertiary-container: '#ffb168'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#a5f693'
  primary-fixed-dim: '#8ad97a'
  on-primary-fixed: '#002201'
  on-primary-fixed-variant: '#005304'
  secondary-fixed: '#ffdad7'
  secondary-fixed-dim: '#ffb3af'
  on-secondary-fixed: '#410005'
  on-secondary-fixed-variant: '#930018'
  tertiary-fixed: '#ffdcc0'
  tertiary-fixed-dim: '#ffb877'
  on-tertiary-fixed: '#2d1600'
  on-tertiary-fixed-variant: '#6b3b00'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
  deep-forest: '#064906'
  medical-green-soft: '#E8F5E9'
  emergency-dark: '#B80021'
  emergency-soft: '#FDECEF'
  pending-soft: '#FFF4E8'
  app-bg: '#F8FAFC'
  border-subtle: '#E2E8F0'
  accent-blue: '#EAF3FA'
typography:
  display-lg:
    fontFamily: Manrope
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Manrope
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
  headline-md:
    fontFamily: Manrope
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  table-data:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  sidebar-width: 260px
  topbar-height: 64px
  gutter: 1.5rem
  margin-mobile: 1rem
  margin-desktop: 2rem
  container-max: 1440px
---

## Brand & Style

This design system establishes a clinical, high-efficiency environment for healthcare professionals. The aesthetic is rooted in **Corporate Modern** principles, prioritizing information density and functional clarity without sacrificing visual comfort. It bridges the gap between traditional hospital reliability and contemporary SaaS usability.

The brand personality is authoritative yet approachable, characterized by:
- **Clinical Precision:** High-contrast layouts and sharp data visualizations that facilitate rapid decision-making.
- **Trustworthy Calm:** A predominantly white and neutral-grey canvas that reduces cognitive load in high-stress environments.
- **Efficiency-First:** A navigation-heavy architecture designed for the multi-tasking nature of hospital administration and clinical care.

## Colors

The color strategy is strictly functional, utilizing a "Semantic First" approach to ensure critical information is never missed.

- **Primary Green (#0B5D0B):** Reserved for core navigation, primary actions (Confirm, Save), and "Success" or "Normal" clinical statuses.
- **Hospital Red (#F2052F):** Used exclusively for emergency flags, critical alerts, and destructive actions. It must be used sparingly to maintain its psychological impact.
- **Flame Orange (#F59A3D):** Denotes "Attention Required," pending lab results, or patients currently in the queue.
- **Neutral Palette:** Utilizes a cool-grey scale to maintain a sterile, modern feel. The background is slightly tinted (#F8FAFC) to reduce screen glare during long shifts.

## Typography

The system uses a dual-font pairing to balance character with utility. **Manrope** provides a modern, geometric structure for headings, while **Inter** ensures maximum legibility for dense medical records and data tables.

- **Headlines:** Use Manrope with semi-bold weights to create a clear content hierarchy.
- **Data Tables:** A specific `table-data` token is provided at 13px to allow for high information density without sacrificing readability on standard hospital monitors.
- **Labels:** Small caps or tracked-out labels should be used for metadata and secondary headers to distinguish them from actionable body text.

## Layout & Spacing

The design system employs a **Fixed Sidebar / Fluid Content** grid model optimized for widescreen desktop use common in clinical workstations.

- **Navigation:** A permanent 260px left sidebar houses the primary application modules. Active states use a solid `Deep Green` background with a `Flame Orange` left-edge indicator.
- **Grid:** A 12-column fluid system handles the main workspace. 
- **Density:** Spacing is tighter than consumer apps (8px base unit) to ensure more patient data is visible "above the fold."
- **Breakpoints:**
  - **Desktop (1024px+):** Full sidebar and multi-pane patient views.
  - **Tablet (768px - 1023px):** Collapsed sidebar (icon-only) and stacked dashboard cards.
  - **Mobile (<767px):** Bottom navigation or "Hamburger" menu; single-column data entry.

## Elevation & Depth

To maintain a "Clinical Modern" look, the system avoids heavy shadows, opting instead for **Tonal Layering** and **Low-Contrast Outlines**.

- **Level 0 (Surface):** App Background (#F8FAFC) - the base canvas.
- **Level 1 (Cards):** Pure White (#FFFFFF) with a 1px border (#E2E8F0). No shadow. Used for standard dashboard modules.
- **Level 2 (Active/Modals):** Pure White with a soft, diffused shadow (0px 4px 12px rgba(15, 23, 42, 0.08)). Used for dropdowns, modals, and temporary overlays.
- **Focus States:** High-visibility 2px solid ring using the Primary Green, ensuring accessibility for keyboard navigation.

## Shapes

The system uses **Soft (0.25rem)** roundedness. This subtle curvature softens the "sterile" feel of the medical environment while maintaining the professional structure of a high-utility management platform.

- **Small Components:** Checkboxes, tags, and small buttons use the base 4px radius.
- **Large Components:** Dashboard cards and modal containers use the `rounded-lg` (8px) radius to distinguish them from smaller UI elements.
- **Status Badges:** Use a fully rounded "pill" shape to instantly differentiate metadata from interactive buttons.

## Components

### Buttons
- **Primary:** Solid Primary Green with White text. Bold, clear, and used for the main intent of a screen.
- **Secondary:** Outlined Primary Green. Used for auxiliary actions.
- **Emergency:** Solid Hospital Red. Reserved for "Code Red" alerts or "Delete Patient Record."

### Status Badges
- **Success/Stable:** Medical Green Soft background with Deep Green text.
- **Emergency/Critical:** Soft Red background with Dark Red text.
- **Pending/Observation:** Soft Orange background with Flame Orange text.

### Inputs & Forms
- Inputs feature a 1px border (#E2E8F0) that turns Primary Green on focus. 
- Labels are always positioned above the input field for maximum scanability during data entry.
- Required fields are marked with a Hospital Red asterisk.

### Data Tables
- Header rows use a Soft Blue Accent (#EAF3FA) to separate them from the data rows.
- Row hovering uses a very subtle grey (#F1F5F9) to help clinical staff track lines across wide screens.

### Dashboard Cards
- Metric cards (e.g., "Total Admissions Today") feature a large Headline-LG number with a secondary label.
- A vertical "status strip" on the left edge of the card can be used to color-code the card's priority level (Green, Orange, or Red).