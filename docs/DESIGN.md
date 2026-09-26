# DESIGN.md — ESOL Premier Campus HR Platform

## Vibe
- Vignelli Grid × Institutional Navy: uncompromising baseline grid, tight-set sans in two sizes, deep navy-and-white as canonical palette with gold accent, evoking credibility and authority of an established educational institution.

## Color
- Primary: #1B3B8A
- On Primary: #FFFFFF
- Accent: #B8860B
- On Accent: #0F172A
- Background: #F8F9FB
- Foreground: #0F1A2E
- Muted: #EDF0F5
- Border: #D0D6E2
- Secondary: #2C4F7C

## Typography
- Heading: Inter (family: Inter, sans-serif, weight: 600, url: https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap)
- Body: Inter (family: Inter, sans-serif, weight: 400, url: https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap)

## Visual Language
- Core visual signature: Editorial line rules — thin 1px horizontal dividers between table rows and section headings, replacing cell borders; section labels rendered in small-caps uppercase with letter-spacing, creating a structured newspaper-grid feel.
- Material & depth: Two surface levels — page background (#F8F9FB) and card white (#FFFFFF) with a subtle 1px border; no shadows on standard cards, a restrained box-shadow only on dropdown/modal overlays.
- Containers & buttons: Cards use 1px #D0D6E2 border, 8px radius, white fill. Primary action buttons: #1B3B8A fill, white text, 6px radius. Secondary: #EDF0F5 fill, #0F1A2E text. Destructive: outlined with red border. Inputs: white fill, 1px border, 4px radius, 16px font.
- Layout rhythm: Primary color appears only on sidebar active state, primary buttons, and focus rings. Accent gold appears only on stat-card highlights and badge indicators. Wide whitespace gutters between sections keep density scannable.

## Animation
- Entrance: sidebar nav items fade-in on mount (100ms, ease-out); page content fades in on route change (150ms)
- Interaction: table row hover — background transitions to Muted (#EDF0F5, 100ms); button press scales 0.97 (80ms)
- Scroll / transition: filter/search panels slide down (200ms ease-out); modal overlay fades in (150ms)

## Forbidden
- No large flat color fills on hero/banner/card backgrounds with Primary or Accent
- No frosted glass, large rounded corners (>12px on cards), or sweeping gradients
- No decorative emoji in navigation, headers, or data tables

## Additional Notes
- Login page: split-screen layout — left panel is deep navy (#1B3B8A) with centered logo and tagline; right panel is white with the login form.
- Print styles for salary slip: all navigation, sidebar, and action buttons must use `@media print { display: none }`. Salary slip renders as a clean A4 white page with logo, structured sections, and signatory space.
- Salary slip print page uses black text only (#0F1A2E), no colored backgrounds, thin line rules between sections.
- Company address line: "ESOL Premier Campus (Pvt) Limited — No 179, High Level Road, Pannipitiya, 10230"
- All currency values displayed in LKR format with comma separators (e.g., LKR 45,833.33).
