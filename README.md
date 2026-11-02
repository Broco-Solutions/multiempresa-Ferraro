# Multi-Empresa Ferraro

Aplicación independiente de consulta financiera, privada y de solo lectura. Better Auth 1.7.7 protege el acceso exclusivo del propietario. RFN se consulta desde el servidor; Ferraro Detail y PPF House siguen pendientes. Los importes individuales de RFN nunca se presentan como consolidado completo.

**Estado:** implementación preparada para configuración y validación. La conexión productiva de RFN no está validada: el dominio documentado por RFN (`gestion.rfn-argentina.com`) no resolvió DNS desde el entorno de desarrollo el 02/11/2026. No se utilizaron credenciales ni bases productivas. No se aprovisionó infraestructura, migró producción ni desplegó.

## Desarrollo

Node.js 24 y pnpm 11.9.0. Leer `ARCHITECTURE.md` y `AGENTS.md`.

```sh
pnpm install
cp .env.example .env.local
pnpm dev
```

Sin configuración válida o sin almacenamiento disponible, no se autoriza ninguna consulta financiera. No hay cuenta de demostración ni registro público. La base nueva es **exclusiva de identidad, sesiones y limitación de intentos**; no guarda movimientos ni se conecta a las bases de las empresas.

## Autenticación y primer propietario

Se reutilizan los patrones de [Ferraro](https://github.com/Broco-Solutions/ferraro-manager/blob/main/src/infrastructure/auth/server.ts) y [PPF](https://github.com/Broco-Solutions/ppfhouse/blob/main/src/infrastructure/auth/server.ts): Better Auth, Argon2id (19 MiB, dos iteraciones, paralelismo 1), registro deshabilitado, validación real en servidor y sesiones revocables. Se usa `pg` y el adaptador integrado de Better Auth, sin Prisma. [Persistencia y esquema de Better Auth](https://better-auth.com/docs/concepts/database).

Las sesiones duran como máximo 12 horas **sin renovación**, sin caché de sesión en cookies. Cookies HttpOnly, SameSite=Lax, Secure en producción. Proxy como primera barrera; cada página y cada función pública del adaptador RFN verifica la sesión con la base. Se rechazan cuentas inactivas o ajenas a `AUTH_OWNER_EMAIL`. No se aceptan destinos de redirección del usuario. Solo se publican tres operaciones de autenticación: iniciar sesión, cerrar sesión y consultar la sesión; no existen endpoints de alta, recuperación o administración.

El límite persistente es **5 intentos por 60 segundos en un bucket compartido de login**, adecuado al único propietario. Evita que cambiar encabezados IP eluda el límite, incluso entre instancias concurrentes. Su contrapartida es que intentos ajenos pueden bloquear temporalmente al dueño. Las fallas de almacenamiento impiden iniciar sesión o leer finanzas; nunca se reemplaza la base por memoria. No se imprimen excepciones de autenticación o credenciales.

1. Solicitar autorización para una base PostgreSQL independiente de autenticación y su costo. **No usar las bases de RFN, Ferraro ni PPF.** Configurar conexión TLS con certificado verificado según el proveedor (`sslmode=verify-full`); no deshabilitar la validación TLS.
2. En una terminal privada de operador, completar `.env.local` con `AUTH_DATABASE_URL`, `AUTH_OWNER_EMAIL`, `BETTER_AUTH_URL` (origen exacto de la aplicación) y `BETTER_AUTH_SECRET` (generar con `openssl rand -base64 48`). No copiar el secreto de otras aplicaciones. Para desarrollo usar `http://localhost:3000`; en producción HTTPS es obligatorio.
3. Revisar [docs/auth-schema.sql](docs/auth-schema.sql), generado con Better Auth 1.7.7. Después de autorización específica, aplicar el esquema a la base exclusiva con `pnpm auth:schema --apply`. Este comando es manual; nunca se ejecuta desde build, despliegue o una petición web. `pnpm auth:schema` solo genera el plan SQL contra la base configurada, sin aplicar cambios.
4. Agregar temporalmente en `.env.local` `BOOTSTRAP_OWNER_NAME` y `BOOTSTRAP_OWNER_PASSWORD` (12–128 caracteres, única, guardada en un gestor). Ejecutar `pnpm auth:bootstrap`. El script inserta directamente el hash Argon2id en una transacción; rechaza cualquier alta posterior y no permite actualizar contraseñas. Un índice único limita la tabla a un propietario. No hay endpoint de bootstrap.
5. **Eliminar `BOOTSTRAP_OWNER_PASSWORD` y `BOOTSTRAP_OWNER_NAME` del archivo y del entorno de la terminal inmediatamente después del alta.** No configurarlas en Vercel, en argumentos CLI, logs, CI o Git. Conservar la contraseña únicamente en el gestor del propietario.
6. Usar un usuario PostgreSQL de aplicación con permisos de lectura/escritura solo sobre las tablas de identidad, sin permisos DDL; reservar la conexión de migraciones para el operador. Para desactivar el acceso, el operador puede poner `active=false` y borrar sus sesiones en la base de identidad; la siguiente consulta privada las rechaza. La rotación o recuperación de contraseña requiere procedimiento privado de operador, fuera de esta tarea.

## Variables y Vercel

| Variable privada | Propósito |
| --- | --- |
| `BETTER_AUTH_URL` | Origen HTTPS exacto de Multi-Empresa en producción, sin ruta ni comodines |
| `BETTER_AUTH_SECRET` | Secreto aleatorio independiente, mínimo 32 caracteres; tipo Secret |
| `AUTH_DATABASE_URL` | PostgreSQL exclusivo de identidad, conexión TLS verificada; tipo Secret |
| `AUTH_OWNER_EMAIL` | Único email autorizado, igual al creado con bootstrap |
| `RFN_API_BASE_URL` | Origen HTTPS de RFN verificado con su operador, barra final y sin ruta |
| `RFN_API_KEY` | Mismo valor que `CONSOLIDADO_API_KEY` ya configurado en RFN/Railway, mínimo 32 caracteres; tipo Secret |
| `RFN_EXPECTED_COMPANY_ID` | `rfn-argentina` |

Todos son nombres **sin `NEXT_PUBLIC_`**. `.env.example` y `.env.rfn.example` contienen exclusivamente valores ficticios. El dominio sugerido por el contrato RFN debe confirmarse con el operador: leer el código no acredita disponibilidad del servicio.

1. Abrir **Vercel → Project → Settings → Environment Variables** del proyecto Multi-Empresa.
2. Crear las siete variables anteriores y seleccionar únicamente **Production**. Elegir **Secret** para `RFN_API_KEY`, `BETTER_AUTH_SECRET` y `AUTH_DATABASE_URL` (si la interfaz lo denomina Sensitive, usar esa protección). No pegar sus valores en tickets, PRs ni capturas.
3. No copiar secretos productivos a Preview/Development. Si se necesita probar un preview, configurar por separado su origen HTTPS exacto, secreto y base aislada; no confiar en `*.vercel.app` ni inferir el origen desde encabezados.
4. Con esquema y propietario preparados y aprobación de publicación, generar **un nuevo despliegue** o usar Redeploy para que se carguen las variables. Los cambios de variables no actualizan las instancias existentes. Este PR no fusiona ni despliega automáticamente.
5. Antes de cargar RFN, verificar sin sesión `/`, `/empresas/rfn-argentina`, `/gastos`, `/ingresos` y `/movimientos`, incluidos RSC y cookie inválida: todos redirigen a `/login`, sin datos. Probar credenciales erróneas, límite de intentos, origen ajeno, cookie Secure/HttpOnly/SameSite y logout con reutilización de cookie anterior.
6. Con sesión válida, abrir `/empresas/rfn-argentina` y consultar un rango cerrado conocido. El servidor verifica identidad, USD, período argentino exacto y consistencia decimal. Comparar cobros, gastos, compras, egresos y saldo contra RFN para **el mismo rango**. Si el origen usa UTC y devuelve límites distintos, la aplicación muestra error de período: no relajar esa validación ni afirmar exactitud antes de resolverlo con el operador.
7. Verificar `/gastos`, filtros y paginación. No incluye compras; los sueldos ya forman parte de gastos. No se publica el concepto libre por posible información personal. `/ingresos` y `/movimientos` mantienen estados honestos: la API no provee pagos individuales fechados ni un ledger completo. No hay evolución mensual disponible.
8. No llamar RFN desde el navegador ni escribir claves en comandos de prueba. No alterar variables de Railway. Ante cualquier error se conserva «Consolidado incompleto» y un estado sin datos, nunca USD cero sustituto.

## Validación aislada

```sh
pnpm install
pnpm lint
pnpm typecheck
pnpm exec vitest run
pnpm build
```

Sin `AUTH_TEST_DATABASE_URL`, Vitest ejecuta las pruebas unitarias y marca las seis de persistencia como omitidas. Para ejecutar también autenticación real y E2E, iniciar **un PostgreSQL local desechable**; la siguiente contraseña es ficticia y solo de pruebas:

```sh
docker run --detach --rm --name multiempresa-auth-test \
  -e POSTGRES_PASSWORD=isolated-test-only -e POSTGRES_DB=multiempresa_auth_test \
  -p 127.0.0.1:55439:5432 postgres:17-alpine
export AUTH_TEST_DATABASE_URL='postgresql://postgres:isolated-test-only@127.0.0.1:55439/multiempresa_auth_test'
pnpm exec vitest run
pnpm exec playwright install --with-deps chromium
pnpm exec playwright test
docker stop multiempresa-auth-test
unset AUTH_TEST_DATABASE_URL
```

**Las pruebas de persistencia y Playwright borran el esquema `public` de esa base local de pruebas.** Rechazan hosts externos y nombres que no terminen en `_test`. Ejecutarlas secuencialmente. Playwright inicia su propio Next y una API RFN ficticia exclusivamente en `tests/fixtures`, reemplaza todas las variables de RFN y autenticación y usa un propietario aislado. No reutiliza un servidor existente ni consulta RFN productivo. Las fixtures nunca se importan desde `src/`.

Se prueban Argon2id, cookies, expiración, revocación, cuenta inactiva, signup cerrado, origen ajeno, concurrencia del límite entre instancias, rangos argentinos, reglas decimales, HTML/RSC anónimos, cookie falsificada, navegación, gastos y errores sin ceros. La validación productiva y reconciliación de importes siguen pendientes del operador autorizado.
