# Design system — heat-dashboard

Fuente única leída: `src/styles.css` (tema «Asfalto y brasa»). No se inventaron valores: solo tokens presentes en las fuentes.

RefreSco 25/11/2025: `src/styles.css` cambió con HDH-UI04 (rail de campeonatos, duos, responsive), pero solo añadió clases de componentes: los tokens de `:root` y las fuentes son idénticos; no hubo que re-capturar valores.

## Colores

| Token | Valor |
| --- | --- |
| `--bg` | `#14110f` — fondo de página (`src/styles.css`) |
| `--surface` | `#1d1916` — paneles/cards (`src/styles.css`) |
| `--surface-2` | `#28221f` — superficies anidadas: tablas th, play-item, select (`src/styles.css`) |
| `--surface-3` | `#342d29` — nivel hover/énfasis de superficie (`src/styles.css`) |
| `--line` | `#39322d` — bordes de paneles y header h1 (`src/styles.css`) |
| `--text` | `#f2ece5` — texto principal (`src/styles.css`) |
| `--text-muted` | `#a99f95` — texto secundario/metadatos (`src/styles.css`) |
| `--accent` | `#ff7a2f` — acento de brasa: títulos de sección, posición, hover de card (`src/styles.css`) |
| `--accent-ink` | `#1d0d03` — texto sobre acento (`src/styles.css`) |
| `--accent-soft` | `rgba(255, 122, 47, 0.14)` — acento translúcido (`src/styles.css`) |
| `--good` | `#46c98b` — estado positivo (`src/styles.css`) |
| `--dot-off` | `#473f39` — punto inactivo (`src/styles.css`) |
| `--chart-grid` | `rgba(255, 255, 255, 0.06)` — rejilla de charts (`src/styles.css`) |

Los colores de jugador no living aquí: viven en `src/data/player-colors.json` (paleta validada de 12, ver `scripts/validate-palette.js`) y se inyectan como `--pc`.

## Tipografía

| Token | Valor |
| --- | --- |
| `--font-display` | `'Big Shoulders Display', 'Barlow Condensed', sans-serif` (`src/styles.css`, Google Fonts) |
| `--font-body` | `'Barlow', system-ui, sans-serif` (`src/styles.css`, Google Fonts) |
| Títulos h1/h2/h3 | `--font-display`, weight 700, letter-spacing 0.01em (`src/styles.css`) |
| Título campeonato card | `'Barlow Condensed'`, 1.4rem, color `--accent` (`src/styles.css`) |
| KPI número | `--font-display`, 1.6rem, weight 700 (`src/styles.css`) |
| KPI etiqueta | `--font-body`, 0.85rem, weight 600, color `--text-muted` (`src/styles.css`) |
| Metadatos | 0.85–0.9rem, `--text-muted` (`src/styles.css`) |
| Números | `font-variant-numeric: tabular-nums` en `body` (`src/styles.css`) |

Nota: los artboards de design/ no pueden cargar Google Fonts; sustituir por pilas de sistema condensed/sans equivalentes.

## Espaciado y forma

| Token | Valor |
| --- | --- |
| `--gutter` | `28px` (16px ≤720px) (`src/styles.css`) |
| `--radius` | `12px` (`src/styles.css`) |
| `--radius-sm` | `8px` (`src/styles.css`) |
| Radio real de paneles | `10px` en cards y secciones (`src/styles.css`) |
| Padding de paneles | `20px` en cards/sections (`src/styles.css`) |
| Border de card | `2px solid var(--surface-2)`; hover → `--accent` (`src/styles.css`) |
| Gap de grid | `20px` (`src/styles.css`) |

## Gradientes y bordes

| Token | Valor |
| --- | --- |
| `--edge` | `linear-gradient(90deg, #ffb52e, #ff6a2b 45%, #e5392f)` — filete 3px bajo el header (`src/styles.css`) |

## Componentes

- **Panel (`campeonato-card`, `campeonato-section`, `podium-panel`)**: fondo `--surface`, borde `--line` o `2px --surface-2`, radius 10px, padding 20px. Hover de card: borde `--accent`.
- **Tabla (`standings-table`)**: `border-collapse: collapse`, th con fondo `--surface-2`, texto `--text-muted` 0.85rem, filas con `border-bottom: 1px var(--surface-2)`, columna `.pos` en `--accent`.
- **Botones**: `.btn-primary` acento, `.btn-secondary` superficie con borde, `.btn-danger` rojo, `.btn-narrow` compacto. 

## Chart.js

La app usa Chart.js (barra/llínea) con ejes y rejilla `--chart-grid`; los artboards dibujan charts con SVG en línea (sin CDN).
