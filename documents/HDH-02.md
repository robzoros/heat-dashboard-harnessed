# Especificación de Diseño: Proxy Intermedio para BoardGameGeek (BGG)

Este documento detalla la lógica de negocio, el flujo de decisiones y el pseudocódigo necesarios para implementar desde cero un servidor intermedio (proxy) que conecte una aplicación web con la API de BoardGameGeek, gestionando la autenticación de forma transparente.

---

## 1. Factores Críticos a Tener en Cuenta

Antes de escribir código, se deben prever los siguientes escenarios en el entorno de producción:

*   **Seguridad de las Credenciales:** El flujo transporta contraseñas en texto plano. Es obligatorio que el tráfico entre la aplicación cliente y este servidor viaje exclusivamente bajo **HTTPS**.
*   **Persistencia de Sesión Volátil:** Al almacenar las cookies en la memoria de ejecución (`let sessionCookies`), cualquier reinicio o nuevo despliegue del servidor limpiará la sesión, obligando a re-autenticar a los usuarios.
*   **Límites de Peticiones (Rate Limiting):** Al centralizar las consultas de múltiples usuarios en una sola IP (la del servidor), BGG podría interpretar el tráfico como un ataque y bloquear la IP.
*   **Ausencia de Refresco Automático:** El sistema no valida proactivamente si la sesión expiró por inactividad en los servidores de BGG; reacciona únicamente cuando recibe un error.

---

## 2. Flujo Lógico de Decisiones

El servidor debe evaluar cada petición entrante siguiendo este árbol jerárquico de condiciones:

```text
                  [ Petición Recibida ]
                            |
             ¿Es una petición de control (OPTIONS)?
              /                             \
          (Sí)                             (No)
            |                                |
   [ Responder OK con CORS ]         ¿Es la ruta "/login"?
                                      /               \
                                  (Sí)                (No)
                                    |                   |
                           [ Procesar Login ]     ¿Empieza por "/xmlapi2/"?
                           [ Guardar Cookies]       /                 \
                                                (Sí)                  (No)
                                                  |                     |
                                       [ Intentar con Cookies ]   [ Error 404 ]
                                                  |
                                        ¿Error 401 (Caducado)?
                                         /                  \
                                     (Sí)                   (No)
                                       |                      |
                            [ Reintentar sin Cookies ]  [ Enviar Respuesta ]
                                       |
                              [ Enviar Respuesta ]