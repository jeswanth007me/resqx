# ResQX — Design System

> **Source of Truth**: Stitch Project "ResQX Emergency Operations Center"
> Project ID: `6434206381845141979`
> Design System: `ResQX EOCC`

---

## Brand & Style

The ResQX design system is engineered for **high-stakes, mission-critical environments** where cognitive load management is paramount. The personality is authoritative, precise, and utilitarian, drawing from **Modern SaaS** and **Glassmorphism** to create a focused control room experience.

The system prioritizes functional density over decorative elements. It utilizes deep backgrounds to reduce eye strain during long shifts and employs high-contrast semantic signaling to ensure critical alerts are never missed. The aesthetic avoids "gamey" tropes in favor of professional, geometric structuralism that reflects the serious nature of emergency traffic management.

---

## Colors

The palette is optimized for a dark-room EOCC environment, utilizing a **"Lights-Out"** philosophy where color is reserved strictly for status and action.

### Surface Foundations

| Token                     | Value     | Usage                           |
|---------------------------|-----------|----------------------------------|
| `background`              | `#0B1326` | Base application background      |
| `surface`                 | `#0B1326` | Primary surface                  |
| `surface-dim`             | `#0B1326` | Dimmed surface                   |
| `surface-bright`          | `#31394D` | Elevated bright surface          |
| `surface-container-lowest`| `#060E20` | Deepest container                |
| `surface-container-low`   | `#131B2E` | Low-emphasis container           |
| `surface-container`       | `#171F33` | Default container                |
| `surface-container-high`  | `#222A3D` | High-emphasis container          |
| `surface-container-highest`| `#2D3449`| Highest-emphasis container       |
| `surface-variant`         | `#2D3449` | Variant surface                  |

### Semantic Signaling

| Token              | Value     | Usage                                          |
|--------------------|-----------|-------------------------------------------------|
| **Emergency Red**  | `#EF4444` | Active incidents, critical errors (override)    |
| `primary`          | `#FFB3AD` | Primary accent (light red)                      |
| `primary-container`| `#FF5451` | Primary container                               |
| `error`            | `#FFB4AB` | Error text                                      |
| `error-container`  | `#93000A` | Error container background                      |
| **Success Green**  | `#10B981` | Signal priority, "all-clear" (override)         |
| `secondary`        | `#4EDEA3` | Secondary accent (green)                        |
| `secondary-container`| `#00A572`| Secondary container                             |
| **Warning Amber**  | `#F59E0B` | Transitional states, pending (override)         |
| `tertiary`         | `#FFB95F` | Tertiary accent (amber)                         |
| `tertiary-container`| `#CA8100`| Tertiary container                              |

### Text & Borders

| Token                | Value     | Usage                          |
|----------------------|-----------|--------------------------------|
| `on-surface`         | `#DAE2FD` | Primary text on surfaces       |
| `on-surface-variant`  | `#E4BEBA` | Secondary/metadata text        |
| `on-background`      | `#DAE2FD` | Text on background             |
| `outline`            | `#AB8986` | Visible borders                |
| `outline-variant`    | `#5B403E` | Subtle borders                 |
| `on-primary`         | `#68000A` | Text on primary                |
| `on-secondary`       | `#003824` | Text on secondary              |
| `on-tertiary`        | `#472A00` | Text on tertiary               |
| `on-error`           | `#690005` | Text on error                  |
| `on-error-container` | `#FFDAD6` | Text on error container        |

### Legacy Reference Colors

These colors appear in the Stitch design documentation for reference:

| Name             | Value     | Usage                              |
|------------------|-----------|------------------------------------|
| Primary text     | `#F8FAFC` | Maximum legibility on labels       |
| Secondary text   | `#94A3B8` | Metadata and inactive states       |
| Panel border     | `#334155` | Subtle panel borders (glassy feel) |

---

## Typography

Dual-font strategy separating narrative information from technical data.

### Font Families

| Purpose          | Font            | Usage                                      |
|------------------|-----------------|--------------------------------------------|
| Headlines & UI   | **Inter**       | Navigation, titles, section headings, body |
| Data & Telemetry | **JetBrains Mono** | Numbers, timestamps, signal IDs, coordinates |

### Type Scale

| Token           | Family         | Size  | Weight | Line Height | Letter Spacing |
|-----------------|----------------|-------|--------|-------------|----------------|
| `headline-xl`   | Inter          | 32px  | 700    | 40px        | -0.02em        |
| `headline-lg`   | Inter          | 24px  | 600    | 32px        | —              |
| `headline-md`   | Inter          | 20px  | 600    | 28px        | —              |
| `body-lg`       | Inter          | 16px  | 400    | 24px        | —              |
| `body-sm`       | Inter          | 14px  | 400    | 20px        | —              |
| `data-display`  | JetBrains Mono | 18px  | 500    | 24px        | -0.01em        |
| `data-label`    | JetBrains Mono | 12px  | 600    | 16px        | —              |

### Usage Rules

- Headlines use tight tracking for authoritative look
- Labels use **uppercase monospaced** styling for maximum scannability
- Data values use `data-display` to prevent layout shifts from changing numbers

---

## Spacing

All spacing operates on a **4px baseline grid**.

| Token          | Value  | Usage                          |
|----------------|--------|--------------------------------|
| `unit`         | `4px`  | Base spacing unit              |
| `gutter`       | `16px` | Column/panel gutters (4 units) |
| `margin`       | `24px` | Section separation (6 units)   |
| `panel-padding`| `20px` | Internal panel padding (5 units)|

---

## Layout

The layout follows a **Fixed Grid** philosophy for operational dashboards.

### Dashboard Layout
- **12-column grid** for the main viewport
- Side panels (Incident List, Telemetry) docked at **320px** or **400px** width
- Fixed header: **64px** height (h-16)
- Fixed footer/control bar: **80px** height (h-20)
- Main content fills `calc(100vh - 144px)` between header and footer

### Grid Philosophy
- **High-density system**: minimize vertical spacing between rows/list items
- Maximum "at-a-glance" data visible without scrolling
- Predictable, fixed positions for telemetry and map controls

---

## Elevation & Depth

Depth through **Tonal Layers** and **Glassmorphism** — not drop shadows.

| Level | Usage              | Background   | Treatment                                    |
|-------|-------------------|--------------|----------------------------------------------|
| 0     | Base / Map         | `#0B1326`    | Raw background layer                         |
| 1     | Panels             | `#131B2E`    | 1px solid border (`#334155`)                 |
| 2     | Modals / Overlays  | `#171F33`    | 60% opacity + backdrop-blur(12px)            |

### Glass Panel (Header)
```css
background: rgba(23, 31, 51, 0.6);
backdrop-filter: blur(12px);
border-bottom: 1px solid rgba(218, 226, 253, 0.1);
```

### Control Bar (Footer)
```css
background: rgba(19, 27, 46, 0.8);
backdrop-filter: blur(16px);
border-top: 1px solid rgba(218, 226, 253, 0.1);
```

### Highlighting
- Thin 1px internal "inner stroke" (top edge only) at 20% white opacity

---

## Components

### Operational Control Bars
- Horizontal bars fixed to top/bottom of panels
- Slightly lighter slate background to separate actions from data
- Backdrop blur for glassmorphism effect

### High-Contrast Status Badges
- Small rectangular badges
- Subtle background tint + high-contrast text
- **Emergency**: solid `#EF4444` background with white text
- **Priority**: `secondary/10` background with `secondary` text
- **Preparing**: `tertiary/10` background with `tertiary` text, pulsing animation

### Telemetry Cards (Incident Cards)
- Colored **Priority Stripe** on left edge (1.5px–4px width)
- Stripe color matches semantic status:
  - Red stripe → Critical/Emergency
  - Amber stripe → Transport/Warning
  - Green stripe → Available/Success
- Dark container background with hover state

### Data-Dense Tables
- Row background: `surface-container-low`
- No vertical borders
- `outline-variant` horizontal dividers
- Typography: `body-sm` for labels, `data-display` for values

### Input Fields
- Background: `surface-container-lowest` (`#060E20`)
- 1px border
- Focus: 1px `#10B981` glow

### Interactive Map Elements
- **Pins**: Geometric diamond shapes with 2px stroke
- Soft outer glow in semantic color
- **Ambulance marker**: Circle with ping animation
- **Hospital**: Rectangle with status indicator dot

---

## Shapes

"Soft-Technical" shape language.

| Element              | Radius  |
|----------------------|---------|
| Default (sm)         | `2px` (0.125rem) |
| Standard (DEFAULT)   | `4px` (0.25rem)  |
| Medium (md)          | `6px` (0.375rem) |
| Large (lg)           | `8px` (0.5rem)   |
| Extra Large (xl)     | `12px` (0.75rem) |
| Full                 | `9999px`         |

- **Status Badges**: 2px radius (sharp, data-centric)
- **Action Buttons**: 4px standard
- **Active Selection**: Sharp vertical bars (0px radius) on left side

---

## Navigation

Shared across all screens:

| Tab              | Path                | Description                     |
|------------------|---------------------|---------------------------------|
| Simulation       | `simulation`        | Live simulation dashboard       |
| Emergency Queue  | `emergency-queue`   | Active emergency responses      |
| Signals          | `signals`           | Signal priority network         |
| Network Analytics| `network-analytics` | Performance reports & analytics |
| Settings         | `settings`          | System configuration            |

### Active State
- Text: `primary` color
- Bottom border: 2px solid `primary`
- `aria-current="page"` attribute

### Inactive State
- Text: `on-surface-variant`
- Hover: `on-surface`
- Transparent bottom border

---

## Status Colors

| Status          | Color Token | Hex       | Usage                      |
|-----------------|------------|-----------|----------------------------|
| Critical        | `error`    | `#FFB4AB` | Active emergencies         |
| Emergency (bg)  | `error-container` | `#93000A` | Emergency backgrounds |
| Active/Priority | `secondary`| `#4EDEA3` | Active signals, optimal    |
| Preparing       | `tertiary` | `#FFB95F` | Transitional/pending       |
| Congested       | `tertiary` | `#FFB95F` | Traffic congestion warning |
| Normal/Inactive | `on-surface-variant` | `#E4BEBA` | Normal state     |
| Override        | `error`    | `#FFB4AB` | Signal overrides           |

---

## Responsive Behavior

- Primary target: **Desktop dashboards** (1280px–2560px)
- `hidden xl:block` for auxiliary info (UTC clock)
- Grid columns collapse on smaller screens:
  - `grid-cols-1 md:grid-cols-2 lg:grid-cols-4` for metrics
  - Sidebars stack below map on mobile
- Scrollbar hidden by default (`::-webkit-scrollbar { display: none }`)
- Custom thin scrollbars for terminal/list views (4px width)
