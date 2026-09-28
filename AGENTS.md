# AGENTS.md

## Contexto del proyecto

Dashboard web de estadísticas para partidas del juego de mesa **Heat: Pedal to the Metal**, construido a partir de datos obtenidos online de la API de BoardGameGeek (BGG).

## Flujo de Trabajo de Inicio

Antes de escribir código:

1. Ejecuta el script bash `init.sh`. Si sale con error terminas. La verificación ya no requiere Docker.
2. Lee `PROGRESS.md` para el estado verificado más reciente y el próximo paso.
3. Lee `features_list.json` y elige la feature inacabada de mayor prioridad.
4. **Crea nueva rama con el id de la feature como nombre.**
   - **IMPORTANTE: Este paso debe completarse ANTES de modificar CUALQUIER archivo del repositorio.**
   - No se permite editar `PROGRESS.md`, `features_list.json` ni ningún otro archivo hasta que la rama exista.
5. Crea plan de acción que se guardará en los comentarios del commit
6. Deja evidencia de que se ha resuelto la tarea.

Si la verificación de referencia ya está fallando, corrígela primero. No apiles trabajo de features nuevas sobre un estado inicial roto.
Si trabajas con tasks actualiza la task y cuando se hayan completado todas actualiza el status de la feature.

## Stack técnico

- **Frontend**: HTML + CSS + JavaScript puro + Chart.js + Google Fonts (Bebas Neue, Barlow Condensed, Barlow)
- **Publicación**: GitHub Pages publica el directorio `src/`
- **Datos**: GitHub Actions genera semanalmente `src/data/heat-data.json` usando Node.js 20 y la API de BGG
- **Repositorio**: Github
- **Servidor local**: `python3 -m http.server 8082 --directory src`

## Reglas de Trabajo

- Cada sesión resuelve una y solo una feature a la vez.
- Mantén siempre el mismo diseño de UI para todos los elementos.
- Al empezar a trabajar modifica su status a in_progress.
- No marques una feature/task como completa solo porque se añadió código.
- Mantén los cambios dentro del alcance de la feature seleccionada a menos que un bloqueo fuerce una corrección de soporte estrecha.
- No cambies silenciosamente las reglas de verificación durante la implementación.
- Si no pasa las pruebas haz los cambios necesarios y vuelve a intentarlo (5 veces como máximo)
- Para las pruebas de datos estáticos usar `python3 -m http.server 8082 --directory src`; no se requieren credenciales BGG en el navegador.
- Después de implementar una feature, crear/actualizar su spec en `e2e/tests/<feature-id>.spec.js`
- Cada spec debe generar screenshots de evidencia con `page.screenshot()` donde aplique (ej. después de cargar datos, aplicar filtros, etc.)
- Tras pasar la verificación local, ejecutar `cd e2e && npm run capture:evidence` para generar pantallazos usando el servidor HTTP estático.
- Los screenshots generados en local no se versionan en git; la evidencia oficial se almacena como artifacts en GitHub Actions

## Sinónimos
- Player = Jugador
- Main Player = Jugador Principal
- Track = Board = Circuito
- Streak = Racha
- Location = Localización
- Partida = Play

## Artefactos Requeridos

- `features_list.json`: fuente de verdad para el estado de las features
- `PROGRESS.md`: registro de sesión y estado verificado actual
- `init.sh`: ruta estándar de inicio y verificación
- `session-handoff.md`: entrega compacta opcional para sesiones más grandes

## Definición de Completado

Una feature está hecha(completed) solo cuando todo lo siguiente es cierto:
- el comportamiento objetivo está implementado
- la verificación requerida realmente se ejecutó
- se completaron todas las tasks
- la evidencia está registrada en `features_list.json` o `PROGRESS.md`
- el repositorio permanece reiniciable desde la ruta de inicio estándar

## Fin de Sesión

Antes de terminar una sesión:

1. Actualiza `PROGRESS.md`.
2. Actualiza `features_list.json`, solo con las features con las que se ha trabajado en la sesión.
3. Registra cualquier riesgo o bloqueo sin resolver.
4. **Haz commit de todos los cambios** (código + `PROGRESS.md` + `features_list.json`).
5. **Haz push de la rama creada.**
   - Las modificaciones de `PROGRESS.md` y `features_list.json` SIEMPRE se hacen ANTES del push.
6. **Espera a que el GitHub Action termine:**
   - Al hacer push se dispara automáticamente un Action que crea un PR y lo mergea a `main`.
   - Verifica cada **15 segundos** el estado del Action usando `gh run list --workflow=auto-merge.yml --branch=<rama> --limit=1`.
   - Cuando el run aparezca como `completed` con `conclusion=success`, continúa al siguiente paso.
   - Timeout máximo: 5 minutos. Si no termina, informa al usuario.
7. **Haz checkout a `main` y luego `git pull`** para sincronizar con el merge del Action.
   - El push, la espera del Action, el checkout y el pull son siempre los **últimos** pasos.

<!-- BEGIN pi-minimal-harness -->
# AGENTS-addition.md — harness contract for adopting projects

This file contains **only the section you should add to the `AGENTS.md` of a
project that adopts `pi-minimal-harness`**. It is written to be copied and
pasted as-is: it is generic (no project-specific rules) and versioned in this
repository, so you can re-sync later by diffing against this file.

Two ways to adopt it:

1. **Paste (recommended, portable):** copy the section below into your
   project's `AGENTS.md`. Pi loads `AGENTS.md` automatically, and other agent
   tools (Claude Code, Gemini CLI, …) read the same file.
2. **Reference (zero-touch, Pi-only):** keep this file in your repository
   (e.g. `HARNESS.md`) and put a standing instruction at the top of your
   `AGENTS.md`: *"Read `HARNESS.md` in the repository root and follow it for
   every session."* Simpler to re-sync, but the model must actually read the
   file. For guaranteed injection you can instead put the standing rules in
   `.pi/APPEND_SYSTEM.md` (project-level, added to Pi's system prompt; requires
   project trust).

---

## Harness workflow

- Work is executed through the `pi-minimal-harness` pipeline. A workflow mode
  selects an ordered list of agent steps; the runtime sequences them, so steps
  cannot be skipped. Modes: `simple`, `full-dry-run`, `full`,
  `implementation-only`, `delivery-only` (see `defaults.workflow_mode`).
- Commands: `/harness-config`, `/harness-mode`, `/harness-model` (model plus
  supported reasoning effort), `/harness-run <task>`, `/harness-delivery
  [instructions]`, `/harness-auto [on|off]`. `/harness-delivery` runs the
  delivery agent without changing `defaults.workflow_mode`.
- The orchestrator declares its decision with the `harness_decision` tool, once
  at the end of its turn: `ANSWER_ONLY` (questions and tasks that change no
  files — the pipeline stops) or `PIPELINE` (files must change), with a one-line
  `reason`. Without the tool, the fallback is one marker on the last line:
  `HARNESS-DECISION: ANSWER_ONLY` or `HARNESS-DECISION: PIPELINE`. The harness
  moves the decision to the footer; it is not part of the visible answer. With
  `defaults.strict_decision_marker` on, a turn with no usable decision stops the
  pipeline instead of assuming `PIPELINE`.
- Every non-orchestrator agent writes a report in the form `### Changes` /
  `### Evidence` / `### Notes for delivery` **and** calls `harness_report` with
  `changed_files`, `checks` and `notes`. Without the tool, the fallback is
  `HARNESS-DONE` as the last line. The harness verifies the call first and the
  marker second; if neither is present it sends one repair turn for that step
  and stops if the report is still missing.
- There is exactly **one** report format, used by every agent and every session:
  `### Changes` (files changed, one line each), `### Evidence` (checks actually
  run with their result, plus every check that could not be run and why) and
  `### Notes for delivery` (what delivery must know). Completion is summarized
  in those three sections, in terms of changed files and evidence; no second
  format, checklist or closing section is added.
- The harness performs a repository preflight before a pipeline. Warn the user
  about uncommitted changes, branch divergence, or an open pull request; do not
  claim the repository is clean when it is not. With
  `defaults.preflight_policy: blocking` a dirty tree or an open pull request
  stops the first step whose agent is marked `mutates_files: true`.

## Memory — Engram

Recommended packages (user-level): `gentle-engram` plus `pi-mcp-adapter`, with
`engram mcp --tools=agent` registered in `~/.pi/agent/mcp.json`. Memory is
local-first (SQLite + FTS5) and shared across sessions and agents.

- **Save** durable learnings right after: bugfix, architecture/design
  decision, non-obvious discovery, configuration/setup, established pattern, or
  user preference. Format content as **What** / **Why** / **Where** /
  **Learned**; keep titles short; reuse a `topic_key` to evolve a topic instead
  of duplicating it.
- **Search** before repeating work: `mem_context` for recent history, then
  `mem_search` for keywords, then fetch the full observation only if needed.
- **Before ending a session**, save a session summary (Goal, Instructions,
  Discoveries, Accomplished, Next Steps, Relevant Files).
- Do **not** store raw command transcripts, tool output dumps, or facts already
  documented in the repository.

## Structural exploration — CodeGraph

- Use CodeGraph **selectively**, only when relationships matter (callers,
  callees, impact, affected tests). For simple changes, read the source
  directly.
- The index lives at the repository root: `.codegraph/` (its `.gitignore`
  should be tracked; index data should not be committed).
- Useful commands: `codegraph init --cwd <root>`, `codegraph status`,
  `codegraph sync --cwd <root>`, `codegraph explore`, `codegraph callers`,
  `codegraph callees`, `codegraph impact`, `codegraph affected`.
- If the index does not exist or is stale, initialize or sync it before
  relying on results.

## Verification

Before considering a task complete:

- inspect the relevant diff;
- run the project's own checks (focused checks for the touched area, broader
  ones when shared behavior changes);
- report the result of every check, including the ones that could not be run and
  why, inside `### Evidence`;
- report the result in the single format defined above (`### Changes` /
  `### Evidence` / `### Notes for delivery`), never in a second variant.

## Project skills

- Reusable procedures live in `.agents/skills/<name>/SKILL.md` with `name` and
  `description` frontmatter.
- Skills are invoked automatically when the task matches their description, or
  explicitly with `/skill:<name>`.
- This harness ships `github-delivery` (branch → commit → push → pull request
  with the repository's conventions).
- Create a new skill only for a recurring procedure that has safety or
  ordering constraints, or that encodes project-specific conventions.
<!-- END pi-minimal-harness -->

