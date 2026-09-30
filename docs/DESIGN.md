# DESIGN.md — ESOL Premier Campus HR Platform

## Vibe
- Vignelli Grid × Institutional Navy: uncompromising baseline grid, tight-set sans in two sizes, royal navy, globe blue and sky cyan from the ESOL crest-and-globe logo, evoking credibility and authority of an established educational institution.

## Color
Taken directly from the ESOL Premier Campus logo (`public/esol_logo.png`):
- Primary (wordmark navy): #283891
- On Primary: #FFFFFF
- Globe blue: #1972CD — gradients, glows, stat accents
- Globe indigo: #241F5E — deep shadow tone
- Sky cyan: #6FCEF1 — orbit-arrow highlight; sidebar active state, accents on dark surfaces
- Crest silver: #D1D2D4 — rims around the crest tile / logo plate
- Background: #F5F7FB
- Foreground: navy ink (hsl 232 40% 13%)
- Sidebar: deep globe navy #111736

Tailwind: `primary`, `brand-navy`, `brand-globe`, `brand-indigo`, `brand-sky`, `brand-silver`, `bg-gradient-primary` (navy → globe blue).

## Logo usage
- Full logo (`/esol_logo.png`): login, forced password change, salary slip & PDF. Its "PREMIER CAMPUS" text is charcoal, so on dark surfaces it sits on a white plate (`<BrandLogo plate />`).
- Crest only (`/esol_crest.png`): small squares — sidebar, mobile header, favicon. Never squeeze the full wordmark into a square.
- Compact lockup (`<BrandMark />`): crest tile + heavy "ESOL" (the O tinted globe-blue/sky) over widely tracked "PREMIER CAMPUS".
- Orbit motif: `.orbit-ring` thin sky-cyan arcs on dark brand panels, echoing the arrows circling the globe.

## Typography
- Heading: Inter (family: Inter, sans-serif, weight: 600, url: https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap)
- Body: Inter (family: Inter, sans-serif, weight: 400, url: https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap)

## Visual Language
- Core visual signature: Editorial line rules — thin 1px horizontal dividers between table rows and section headings, replacing cell borders; section labels rendered in small-caps uppercase with letter-spacing, creating a structured newspaper-grid feel.
- Material & depth: Two surface levels — page background (#F8F9FB) and card white (#FFFFFF) with a subtle 1px border; no shadows on standard cards, a restrained box-shadow only on dropdown/modal overlays.
- Containers & buttons: Cards use 1px #D0D6E2 border, 8px radius, white fill. Primary action buttons: #283891 fill, white text, 6px radius. Secondary: #EDF0F5 fill, #0F1A2E text. Destructive: outlined with red border. Inputs: white fill, 1px border, 4px radius, 16px font.
- Layout rhythm: Primary color appears only on sidebar active state, primary buttons, and focus rings. Sky cyan appears only on dark surfaces (active nav, orbit arcs, highlights). Wide whitespace gutters between sections keep density scannable.

## Animation
- Entrance: sidebar nav items fade-in on mount (100ms, ease-out); page content fades in on route change (150ms)
- Interaction: table row hover — background transitions to Muted (#EDF0F5, 100ms); button press scales 0.97 (80ms)
- Scroll / transition: filter/search panels slide down (200ms ease-out); modal overlay fades in (150ms)

## Forbidden
- No large flat color fills on hero/banner/card backgrounds with Primary or Accent
- No frosted glass, large rounded corners (>12px on cards), or sweeping gradients
- No decorative emoji in navigation, headers, or data tables

## Additional Notes
- Login page: split-screen layout — left panel is deep globe navy with the full logo on a white plate and tagline; right panel is white with the login form.
- Print styles for salary slip: all navigation, sidebar, and action buttons must use `@media print { display: none }`. Salary slip renders as a clean A4 white page with logo, structured sections, and signatory space.
- Salary slip print page uses black text only (#0F1A2E), no colored backgrounds, thin line rules between sections.
- Company address line: "ESOL Premier Campus (Pvt) Limited — No 179, High Level Road, Pannipitiya, 10230"
- All currency values displayed in LKR format with comma separators (e.g., LKR 45,833.33).
