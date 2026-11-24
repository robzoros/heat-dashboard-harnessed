# Changelog

Todas las novedades relevantes del proyecto se documentan en este fichero.

## [Unreleased]

### Changed

- Tema: se queda **Asfalto y brasa** como única piel. Desaparece la variante «Índigo y coral», el parámetro `?variant=`, el selector flotante y su código, así que ya no hay nada que elegir ni recordar en el navegador.
- Colores de jugadores y bots: paleta nueva pensada para fondos cálidos oscuros (arena, oro, brasa, terracota, cielo, verde, violeta humo y rosa, más 12 tonos apagados para los bots). Sustituye a la anterior, que era azul/verde fría.

### Added

- `scripts/validate-palette.js`: valida una paleta categórica contra los fondos del tema (contraste WCAG ≥ 3:1) y la separación entre colores en visión normal y simulando deuteranopia y protanopia (ΔE76). Sale con código 1 si algo no cumple.
- `node scripts/player-colors.js init --reseed`: reasigna todos los primarios con la paleta actual (los `init` normales siguen conservando lo que hayas ajustado a mano).

### Fixed

- CI: el despliegue en GitHub Pages fallaba de forma intermitente con «No artifacts named "github-pages" were found». El workflow subía el artefacto y desplegaba en el mismo job, de modo que `actions/deploy-pages` consultaba la API de artefactos antes de que estuviera indexado. Ahora `deploy-pages.yml` y `weekly-data.yml` separan los jobs `build` (sube el artefacto) y `deploy` (`needs: build`), y ambos comparten el grupo de concurrencia `github-pages-deploy` para que no haya dos despliegues de Pages a la vez.
- CI: los tests E2E del merge automático se omiten cuando el cambio no toca código ejecutable (solo `PROGRESS.md`, `features_list.json`, `CHANGELOG.md`, `evidence/`, `.agents/`…). La detección está en `.github/scripts/detect-code-changes.sh` y el PR se sigue mergeando igual; antes cada cambio de documentación gastaba ~3 minutos de Playwright.

### Changed

- Resumen: rediseño visual con dos variantes de color para comparar (`?variant=a` índigo y coral, `?variant=b` asfalto y brasa). Cabecera compacta, pestañas fijas, podio con peldaños por puesto, KPIs con etiquetas claras ("Circuito más jugado", "Mejor racha", "Última partida") y gráficos con estilo común. Cada jugador mantiene el mismo color en Victorias, Puntos medios y Evolución de victorias, y los gráficos de una sola serie ya no muestran leyenda. El resto de pestañas hereda la paleta y la tipografía. Un selector flotante temporal permite alternar entre variantes hasta elegir una.

### Changed

- Circuitos: la tarjeta de cada circuito ya no muestra el dato "Pts Medio" (sin valor informativo); en su lugar muestra "Victorias de Bots", contando las victorias de todos los jugadores no principales (bots y otros). Además, al hacer clic en el nombre de un circuito, el panel DISTRIBUCIÓN muestra las victorias de cada jugador principal en ese circuito junto con una entrada agregada "Bots"; un segundo clic sobre el mismo circuito restaura la distribución de partidas.

### Fixed

- Campeonatos: al importar partidas con jugadores que aún no son participantes, el modal ahora pide consentimiento explícito para añadirlos como participantes. Antes aparecía un error sin salida ("Añádelos al campeonato primero") porque no existía ninguna forma de añadirlos; la lista de participantes solo cambia cuando el propietario lo acepta en la casilla del modal.

### Changed

- Campeonatos: las carreras de la tabla de clasificación se muestran de izquierda a derecha en orden cronológico (de la más antigua a la más reciente). Antes se leían de derecha a izquierda porque las columnas se ordenaban por fecha descendente. La lista de partidas mantiene el orden reciente → antigua.
- Campeonatos: en caso de empate en puntos en la clasificación, va por delante el jugador que quedó mejor en la carrera más reciente del campeonato. Antes el desempate era solo por número de victorias; ahora la carrera más reciente es el criterio principal y las victorias quedan como respaldo cuando la última carrera tampoco deshace el empate.
