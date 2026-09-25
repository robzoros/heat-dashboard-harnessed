# Despliegue estático en GitHub Pages

El sitio público se publica desde `src/` y no requiere Docker, nginx ni un servidor Node en tiempo de ejecución.

## Configuración inicial

1. En **Settings → Pages**, seleccionar **GitHub Actions** como fuente de deployment.
2. En **Settings → Secrets and variables → Actions**, crear:
   - `BGG_USER`
   - `BGG_PASS`
3. Lanzar manualmente **Actions → Actualizar datos BGG y publicar Pages → Run workflow** para verificar la configuración.

El workflow semanal `weekly-data.yml` se ejecuta todos los lunes a las 06:00 UTC. El workflow `deploy-pages.yml` publica los cambios que llegan a `main`.

## Flujo de datos

El script `proxy/scripts/generate-bgg-data.js`:

1. autentica contra BGG usando los secrets del workflow;
2. reintenta errores de red, timeouts y respuestas HTTP 403, 408, 425, 429 y 5xx con backoff exponencial y `Retry-After` cuando BGG lo indica;
3. descarga todas las páginas XML de las partidas de Heat;
4. normaliza jugadores, circuitos, localizaciones y partidas;
5. genera `src/data/heat-data.json`;
6. publica `src/` como artifact de GitHub Pages.

Si BGG devuelve un error persistente después de los reintentos o no encuentra partidas, el workflow termina unsuccessfully y GitHub Pages conserva el deployment anterior.

## Persistencia de campeonatos

Los campeonatos ya no se guardan en el servidor. El frontend los almacena en `localStorage`, por lo que:

- persisten en el mismo navegador;
- no se comparten entre dispositivos o navegadores;
- se pueden borrar borrando los datos del sitio;
- el JSON público de partidas no contiene campeonatos.

## Verificación local sin Docker

Desde la raíz del repositorio:

```bash
python3 -m http.server 8082 --directory src
```

En otra terminal:

```bash
cd e2e
npm ci
npx playwright test
```

Para generar las evidencias locales:

```bash
cd e2e
npm run capture:evidence
```

## Privacidad

`heat-data.json` queda servido públicamente. Antes de usar credenciales reales, confirmar que las partidas y nombres que se publicarán son públicos o que se desea anonimizar el JSON exportado. Las credenciales BGG sólo se configuran como secrets y nunca se escriben en el repositorio.
