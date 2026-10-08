# Changelog

Todas las novedades relevantes del proyecto se documentan en este fichero.

## [Unreleased]

### Changed

- Campeonatos: las carreras de la tabla de clasificación se muestran de izquierda a derecha en orden cronológico (de la más antigua a la más reciente). Antes se leían de derecha a izquierda porque las columnas se ordenaban por fecha descendente. La lista de partidas mantiene el orden reciente → antigua.
- Campeonatos: en caso de empate en puntos en la clasificación, va por delante el jugador que quedó mejor en la carrera más reciente del campeonato. Antes el desempate era solo por número de victorias; ahora la carrera más reciente es el criterio principal y las victorias quedan como respaldo cuando la última carrera tampoco deshace el empate.
