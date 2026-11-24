# Changelog

Todas las novedades relevantes del proyecto se documentan en este fichero.

## [Unreleased]

### Changed

- Resumen: rediseño visual con dos variantes de color para comparar (`?variant=a` índigo y coral, `?variant=b` asfalto y brasa). Cabecera compacta, pestañas fijas, podio con peldaños por puesto, KPIs con etiquetas claras ("Circuito más jugado", "Mejor racha", "Última partida") y gráficos con estilo común. Cada jugador mantiene el mismo color en Victorias, Puntos medios y Evolución de victorias, y los gráficos de una sola serie ya no muestran leyenda. El resto de pestañas hereda la paleta y la tipografía. Un selector flotante temporal permite alternar entre variantes hasta elegir una.

### Changed

- Circuitos: la tarjeta de cada circuito ya no muestra el dato "Pts Medio" (sin valor informativo); en su lugar muestra "Victorias de Bots", contando las victorias de todos los jugadores no principales (bots y otros). Además, al hacer clic en el nombre de un circuito, el panel DISTRIBUCIÓN muestra las victorias de cada jugador principal en ese circuito junto con una entrada agregada "Bots"; un segundo clic sobre el mismo circuito restaura la distribución de partidas.

### Fixed

- Campeonatos: al importar partidas con jugadores que aún no son participantes, el modal ahora pide consentimiento explícito para añadirlos como participantes. Antes aparecía un error sin salida ("Añádelos al campeonato primero") porque no existía ninguna forma de añadirlos; la lista de participantes solo cambia cuando el propietario lo acepta en la casilla del modal.

### Changed

- Campeonatos: las carreras de la tabla de clasificación se muestran de izquierda a derecha en orden cronológico (de la más antigua a la más reciente). Antes se leían de derecha a izquierda porque las columnas se ordenaban por fecha descendente. La lista de partidas mantiene el orden reciente → antigua.
- Campeonatos: en caso de empate en puntos en la clasificación, va por delante el jugador que quedó mejor en la carrera más reciente del campeonato. Antes el desempate era solo por número de victorias; ahora la carrera más reciente es el criterio principal y las victorias quedan como respaldo cuando la última carrera tampoco deshace el empate.
