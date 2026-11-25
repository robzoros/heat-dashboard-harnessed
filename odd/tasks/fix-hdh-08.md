# FIX-HDH-08 — Identidad estable de participantes en Campeonatos

Identificar participantes por nombre normalizado (no por id BGG) con snapshot de identidad (nombre/tipo/color), migración automática de campeonatos existentes e informe de resolución.

## Specs

- S1: «Parece que al grabar el campeonato, los jugadores no tienen una identificación exacta y eso hace que cuando más adelante recupere el campeonato para visibilizarrme me muestre otros jugadores.» → Los campeonatos identifican participantes por identidad estable, no por el id por orden de aparición que el exportador de BGG asigna en cada exportación.
- S2: «Ten en cuenta, que para los colores de los jugadores y los bots, los estamos identificando de alguna manera.» → La identidad sigue la convención del sistema de color: nombre para la paleta y snapshot congelado del color/tipo por campeonato.
- S3 (reescribida por el usuario en el Log L6): «Lo estás enfocando mal. Los números 1 a 10 que tienen los jugadores en los campeonatos no identifican a ningún jugador (…) los campeonatos se han creado importando carreras pero tampoco se guardan el identificador de cada partida» → La identidad del participante es el userid de BGG de las partidas; los bots y jugadores sin cuenta BGG reciben un id sintético creado una vez y persistido entre sesiones (registro en repo). La migración automática id→nombre queda retirada por imposible.
- S4 (elección del usuario): «Snapshot congelado por campeonato — participantRefs['1961'...'canales'] = { color: '#e05a2b' }» → El color/tipo del participante se congela al grabarse en cada campeonato.
- S5 (respuesta del usuario): «Primero nos preocupamos del diseño nuevo y luego de la migración» → No se migra nada en esta sesión; los campeonatos legacy se dejan como están para migración guiada posterior.
- S6: «Añade en features_list este cambio» → Nueva feature FIX-HDH-08 en features_list.json.
- S7 (aporte del usuario): «los bots y otros jugadores no usuarios BGG no tienen id, habrá que crear uno ficticio para cada uno de ellos, pero que se conserve entre sesiones» → Registro persistente de ids sintéticos psilétsicos para no-BGG.

## Tasks

| ID | Specs | Ruta | Commit |
| --- | --- | --- | --- |
| T1 | S1, S2 | Helpers de identidad (playerKey, snapshot meta) + creación de campeonato por nombres | feat(championships): stable participant identity |
| T2 | S1, S3 | Consumo por clave: consentimiento de importación, partidas manuales, clasificación y detalle | refactor(championships): key-based consumption |
| T3 | S3, S4, S5 | migrateChampionship + informe (consola y detalle) + persistencia local/Firebase | feat(championships): participant migration with report |
| T4 | S6, S1 | e2e/tests/FIX-HDH-08.spec.js (migración con ids desalineados, creación nueva, informe) | test(championships): migration spec |
| T5 | — | features_list.json + PROGRESS.md + suite completa + evidencia + push | chore: session close |

## Log

- L1 (usuario): «Hay que hacer un cambio de diseño en los campeonatos. Parece que al grabar el campeonato, los jugadores no tienen una identificación exacta y eso hace que cuando más adelante recupere el campeonato para visibilizarrme me muestre otros jugadores. ¿Qué propones para evitar esto? Ten en cuenta, que paqra los colores de los jugadores y los bots, los estamos identificando de alguna manera.»
- L2 (usuario): «Me gustaría migrar los campeonatos actuales pero no sé si vas a ser capaz de relacionar jugador con participante.»
- L3 (usuario): «Implementa el cambio y haz la migración informándome de como has resuelto los participantes. Pista los campeonatos 1961 y 1962 tienen los mismos participantes que son distintos a los de Boadilla Cup»
- L4 (usuario): «Añade en features_list este cambio» — registrado FIX-HDH-08 antes de tocar código (tras crear rama).
- L5: Decisión de diseño aceptada por el usuario: clave = nombre normalizado, snapshot inmutable, migración con verificación cruzada. **Después abandonada por L6.**
- L6 (usuario): «Los números 1 a 10 que tienen los jugadores en los campeonatos no identifican a ningún jugador, por eso creo que la migración no es posible (…) tampoco se guardan el identificador de cada partida. Primero arreglemos el diseño para ver cómo hacemos para que el jugador X de un campeonato tenga el mismo id en otro campeonato y que además lo identifique con su color.» → Pivote: identidad = userid BGG; migración automática retirada; specs S3/S4/S5 reescritas; snapshots congelados por campeonato.
- L7 (usuario): «los bots y otros jugadores no usuarios BGG no tienen id, habrá que crear uno ficticio para cada uno de ellos, pero que se conserve entre sesiones» → S7: syntheticUserid serializado en heat-data.json por el exportador.
- L8 (usuario, decisiones por questionnaire): identidad desde el XML BGG (`userid`); color = snapshot congelado por campeonato; legacy: primero diseño nuevo, migración después.
- L9: Descubrimiento clave: generate-bgg-data.js asigna ids por orden de primera aparición en cada exportación → raíz del defecto; userid XML es estable.
- L10: Firestore real: 1961/1962 comparten participants ['1'..'9'], Boadilla ['10','1','2','4'..'9'] — ids sin significado, ninguna fuente para cotejar (constata L6).
- L11: Suite completa 158/158; specs HDH-09 y FIX-HDH-07 actualizados al formato v2; legacy congelado con aviso en el detalle.

## Tasks

| ID | Specs | Ruta | Commit |
| --- | --- | --- | --- |
| T1 | S1, S2 | Helpers de identidad + creación v2 con snapshot | fix-hdh-08 (incluido) |
| T2v2 | S1, S3 | Resolver por identidad (userid/sintético); migración automática retirada | fix-hdh-08 (incluido) |
| T3v2 | S3, S7 | Generador: syntheticUserid persistente + tests offline | fix-hdh-08 (incluido) |
| T4v2 | S1, S4, S5 | e2e/tests/FIX-HDH-08.spec.js 5/5 + suite 158/158 | fix-hdh-08 (incluido) |
| T5 | S6 | features_list + PROGRESS + commit + push | fix-hdh-08 |