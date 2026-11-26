# FIX-HDH-09 — Migración guiada de participantes legacy por matching de partidas

Casar las partidas guardadas en los campeonatos legacy contra el histórico global por (circuito, fecha) para deducir la identidad estable de cada id legacy, con informe y confirmación del usuario antes de aplicar.

## Specs

- S1 (usuario): «Para la migración podemos intentar "machear" las partidas de campeonato. La partida tiene un circuito y una fecha por lo que creo que se puede hacer automáticamente, porque no creo que haya dos partidas al mismo circuito en la misma fecha.» → Matching por (board, playDate) con verificación posicional de puntajes.
- S2 (usuario): «hay que hacer un cambio en que el jugador X de un campeonato tenga el mismo id en otro campeonato y que además lo identifique con su color» (FIX-HDH-08) → La migración produce el mismo formato v2: participantes por identidad, snapshot congelado nombre/tipo/color, carreras canonicalizadas.
- S3 (usuario): «Primero nos preocupamos del diseño nuevo y luego de la migración» → Esta feature ES la migración, sobre el diseño v2 ya fusionado (FIX-HDH-08 en main).
- S4: La resolución se computa y se muestra como informe (id legacy → jugador identificado, con userid/tipo/color) y exige confirmación explícita (botón) antes de convertir el campeonato; sin match o con ambigüedad no se aplica nada.
- S5: Verificado con datos reales de Firestore (1961/1962/Boadilla): 8/8 partidas casan, 27/27 participantes se resuelven sin conflictos; los id 1–10 de los campeonatos corresponden a la tabla de la exportación en la fecha de importación.

## Tasks

| ID | Specs | Ruta | Commit |
| --- | --- | --- | --- |
| T1 | S2 | app.js: syntheticUserid en cliente (identidad igual a la del exportador para no-BGG) + ajuste de specs FIX-HDH-08 | feat(migration): client synthetic identity |
| T2 | S1, S4 | app.js: resolveLegacyChampionship + applyLegacyResolution + UI (informe y confirmación) | feat(migration): resolution engine and UI |
| T3 | S4 | e2e/tests/FIX-HDH-09.spec.js: informe, aplicación, sin-match | test(migration): spec |
| T4 | S5 | Suite completa + PROGRESS + features_list + push + Action | chore: session close |

## Log

- L1 (usuario): «Para la migración podemos intentar "machear" las partidas de campeonato. La partida tiene un circuito y una fecha por lo que creo que se puede hacer automáticamente, por que no creo que haya dos partidas al mismo circuito en la misma fecha.»
- L2: Chequeo con datos reales (Firestore + heat-data.json): 8/8 partidas casan por (circuito, fecha); alineamiento posicional OK en todas; 27/27 participantes resueltos sin conflictos. Hipótesis del usuario validada. Existen 3 duplicados (circuito,fecha) en el histórico (GB 2026-11-12, USA 2026-11-05, México 2024-02-28) — ninguno entre las 8; el resolver los desambigua por puntajes paralelos.
- L3: Mapa real obtenido: 1961/1962 ids 1–9 → Alfonso (1428263), Automa Rojo, Automa Verde, Automa, Automa2, Automa3, Calvo (80677), Tabo (440730), Zoro (68358); Boadilla ids [10,1,2,4..9] → Automa Azul, Automa, Automa2, Automa4, Automa5, Canales (125535), Carte (43892), Korta (20638), Zoro (68358).
- L4: Suite completa 161/161 (HDH-09 ajustado a keys local-); spec FIX-HDH-09 3/3; hallazgos del debugging: los confirm/alert nativos bloquean el renderer y punctualmente pierden el evento en este runner — los specs stubbean confirm/alert para capturar el informe (el texto del diálogo se verifica igual); el resolver exige copia idéntica posicional (rechazó una semilla incompleta: comportamiento de seguridad correcto).
