# Multi-Empresa Ferraro — Marca y UI

Rebranding 2026-11. Fuente de la paleta y los logos Ferraro: `Broco-Solutions/ferraro-manager` (`docs/FERRARO_BRAND_UI.md`, `public/brand/`).

## Paleta

| Token | Valor | Uso |
| --- | --- | --- |
| `--brand-black` | `#000000` | Sidebar, login, base del tema oscuro |
| `--brand-gray` | `#706F6F` | Detalles no textuales (segmentos, isotipo). No usar como texto sobre negro (4,19:1) |
| `--brand-yellow` | `#FFCE13` | Marca, foco, selección y acción primaria. Nunca representa un estado semántico ni lleva texto blanco |
| `--brand-white` | `#FFFFFF` | Texto sobre negro, placas de logos |

Estados semánticos (`--success`, `--warning`, `--danger`, `--info`) son independientes del amarillo y siempre van con icono + texto.

Colores por empresa (series de gráficos y acentos), definidos en `src/config/companies.ts` vía variables CSS: Ferraro = amarillo, PPF House = plata/grafito, RFN Argentina = rojo de su logo.

## Temas

`src/app/globals.css` define tokens para claro (`:root`) y oscuro (`.dark`). El tema oscuro «cockpit» es el predeterminado; el usuario lo alterna desde la topbar o con ⌘K. El login es siempre oscuro en su panel de marca.

## Logos (`public/brand/`)

| Archivo | Origen | Uso |
| --- | --- | --- |
| `ferraro-logo-white.svg` / `ferraro-logo-black.svg` | ferraro-manager | Sidebar, login, topbar mobile (según tema) |
| `ferraro-logo-tricolor.svg`, `ferraro-lockup-detail-tricolor.svg` | ferraro-manager | Reservados para superficies claras |
| `ferraro-mark-tricolor.svg` | ferraro-manager | Placa de Ferraro Detail y `src/app/icon.svg` |
| `ppf-house-mark.png`, `ppf-house-logo-nombre.png` | ppfhouse | Placa de PPF House (márgenes transparentes recortados) |
| `rfn-logo.png` | rfn-pos | Placa de RFN Argentina (recortado y reducido a 640 px) |

Reglas: no deformar, recolorear ni reconstruir logos con texto. Los logos de empresa se muestran sobre una placa blanca neutra (`CompanyLogo`) para que sean legibles en ambos temas. `/brand/*` e `/icon.svg` son estáticos y públicos (excluidos del proxy de sesión) porque el login los necesita; no contienen datos financieros.

## Componentes

- `src/components/ui/`: primitivas shadcn/ui (button, badge, card, skeleton, sheet, command) y controles nativos estilizados (`Input`, `NativeSelect`). Los filtros siguen siendo formularios GET con `<select>` nativo.
- `src/components/brand/`: `FerraroLogo`, `FerraroMark`, `CompanyLogo`, `CompanyLogoRow`, `ThemeProvider`.
- `src/components/patterns/`: `PageHeader`, `KpiCard`, `StatusBadge`, `Notice`, `CompanyCards`, `CompanySummary` (con barra de composición de egresos), `ComparisonChart` (barras/área/líneas), `ExecutiveFilters`, `PreviousComparison`, `CompanyParticipation` (dona CSS), shell con ⌘K.

## Verificación visual

Los tests unitarios de layout compilan el CSS real con `@tailwindcss/cli` (`tests/fixtures/app-css.ts`, globalSetup de Vitest) y verifican ausencia de overflow a 1440, 768 y 390 px.
