# AGENTS.md

## Contexto del proyecto

Dashboard web de estadísticas para partidas del juego de mesa **Heat: Pedal to the Metal**, construido a partir de datos obtenidos online de la API de BoardGameGeek (BGG).

## Flujo de Trabajo de Inicio

Antes de escribir código:

1. Ejecuta script bash `init.sh`. Si sale con error terminas.
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
- **Servidor**: nginx:alpine en Docker
- **Proxy BGG**: Node.js 20 (servicio separado en Docker)
- **Datos**: llamada a la API de BGG
- **Repositorio**: Github
- **Docker**: `docker compose up -d --build` → http://localhost:8082

## Reglas de Trabajo

- Cada sesión resuelve una y solo una feature a la vez.
- Mantén siempre el mismo diseño de UI para todos los elementos.
- Al empezar a trabajar modifica su status a in_progress.
- No marques una feature/task como completa solo porque se añadió código.
- Mantén los cambios dentro del alcance de la feature seleccionada a menos que un bloqueo fuerce una corrección de soporte estrecha.
- No cambies silenciosamente las reglas de verificación durante la implementación.
- Si no pasa las pruebas haz los cambios necesarios y vuelve a intentarlo (5 veces como máximo)
- Para las pruebas de conexión con BGG usar usuario/password de archivo secrets.

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
6. **Haz checkout a `main`.**
   - El push y el checkout a `main` son siempre los **últimos** pasos.
   - Las modificaciones de `PROGRESS.md` y `features_list.json` SIEMPRE se hacen ANTES del push.

