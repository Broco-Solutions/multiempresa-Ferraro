# Arquitectura — Multi-Empresa Ferraro

**Versión:** 1.1 — línea base técnica de la primera implementación (2026-11-02).
**Repositorio destino:** [Broco-Solutions/multiempresa-Ferraro](https://github.com/Broco-Solutions/multiempresa-Ferraro), rama `main`.
**Propósito:** servir como referencia técnica estable para Codex y desarrolladores. Una tarea concreta debe respetar este documento sin ampliar su alcance por iniciativa propia.

## 1. Producto y límites

Multi-Empresa es una **cuarta aplicación independiente**, de consulta financiera, para el dueño de Ferraro Detail, PPF House y RFN Argentina. No reemplaza ni administra los sistemas de origen.

La página de inicio será **simple**: ingresos, egresos totales, saldo neto, resumen por empresa, período seleccionado y evolución financiera. Desde sus tarjetas y navegación se accede a páginas de detalle (ingresos, gastos/compras/sueldos, movimientos y empresas). La sección financiera permite filtrar por empresa y ver el conjunto en una sola aplicación.

Las categorías y la profundidad del detalle dependen de los datos que realmente provea cada empresa. No imponer categorías artificiales ni copiar módulos simulados de la demo.

## 2. Stack técnico de referencia

Se adoptan las tecnologías ya utilizadas en Ferraro y PPF, evitando copiar dependencias que no necesita una aplicación de solo lectura.

| Capa | Decisión | Referencia comprobada |
| --- | --- | --- |
| Runtime | Node.js 24 | Ferraro y PPF |
| Package manager | pnpm 11.9.0; lockfile `pnpm-lock.yaml` | Ferraro y PPF |
| Framework | Next.js 16, App Router y Server Components | Ferraro y PPF (16.3.8) |
| UI | React y React DOM 19 | Ferraro y PPF (19.3.0) |
| Lenguaje | TypeScript 5, `strict: true`, alias `@/*` hacia `src/*` | Ferraro y PPF (5.9.3) |
| Diseño | CSS nativo con variables semánticas, CSS Modules y layout responsive | `src/design-system/` en Ferraro y PPF |
| Fuente | Inter, cargada mediante `next/font` | Ferraro y PPF |
| Componentes | Primitivas propias y patrones `Page`, `PageHeader`, `DataToolbar`, etc. | Ferraro y PPF |
| Iconos | `@phosphor-icons/react` | Ferraro y PPF (2.1.10) |
| Formularios complejos | `react-aria-components` solo cuando aporte accesibilidad real | Ferraro y PPF (1.22.1) |
| Gráficos | Recharts 3 en componentes cliente aislados | RFN POS (3.10.1) |
| Validación de datos externos | Zod 4 | Ferraro y PPF (4.6.5) |
| Calidad | ESLint 9, Prettier 3, Vitest, Playwright y `tsc` | Ferraro y PPF |
| Datos | `fetch` desde el servidor a APIs HTTPS de solo lectura | Sin conexión directa a las bases |

**Versiones:** las cifras entre paréntesis son versiones verificadas en `main` al redactar este documento, no permiso para instalar todas las dependencias de origen. Para iniciar el repositorio usar versiones concretas compatibles y un lockfile; no actualizar de versión mayor ni agregar librerías sin necesidad demostrada.

No introducir Tailwind, shadcn/ui, Redux, Zustand, SWR, React Query ni un framework backend separado por defecto. Utilizar Next.js para las páginas y, si hiciera falta, Route Handlers mínimos propios.

**No crear Prisma ni almacenamiento persistente de movimientos en Multi-Empresa.** Excepción solicitada para autenticación del propietario: PostgreSQL independiente y exclusivo para identidad, sesiones y controles de seguridad, mediante `pg` y el adaptador integrado de Better Auth 1.7.7. No se usa ninguna base de las empresas ni se almacenan finanzas. El aprovisionamiento y las migraciones productivas requieren autorización específica; no se ejecutan en build ni despliegue. Ver `README.md` y `docs/auth-schema.sql`.

## 3. Referencia visual y experiencia

- Tomar de Ferraro y PPF la **estructura visual y los patrones**: tokens CSS, jerarquía tipográfica, tablas, filtros, tarjetas, navegación, estados vacíos y comportamiento mobile.
- Adaptar los componentes estrictamente necesarios; no clonar el monolito, sus pantallas operativas ni miles de líneas de estilos globales.
- Crear una identidad visual sobria y neutral de Multi-Empresa; usar marcas oficiales de cada empresa cuando estén disponibles y autorizadas. No inventar logos.
- Diseño responsive, accesible (teclado, etiquetas, contraste y estados de carga/error), con importes legibles y fechas/períodos explícitos.
- **Página principal liviana.** Los listados grandes y filtros avanzados pertenecen a secciones específicas.
- Nunca colocar importes falsos como datos reales ni usar un login de demostración. Sin fuente conectada, mostrar «Sin datos» o «Pendiente de conexión», no cero.

## 4. Diseño lógico y flujo de datos

`Navegador -> aplicación Next.js Multi-Empresa (servidor) -> adaptador por empresa -> API segura de cada origen.`

1. Las rutas y Server Components solicitan datos a una capa común de servicios en servidor.
2. Cada adaptador conoce la API y semántica **de su empresa**: Ferraro, PPF o RFN. La interfaz no conoce credenciales ni rutas internas de los orígenes.
3. Validar la respuesta HTTP y su estructura con Zod; verificar empresa, moneda y período respondidos. Convertirla a una representación común sin perder tipo, origen, ID, categoría original ni trazabilidad.
4. Calcular importes con exactitud y mostrar datos agregados y detalles mediante vistas de solo lectura.
5. Las visualizaciones interactivas son componentes cliente pequeños; no duplicar consultas en el navegador ni enviar secretos al cliente.

Organización implementada:

- `src/app/`: rutas del dashboard y páginas de detalle.
- `src/components/` y `src/design-system/`: componentes y estilos reutilizables.
- `src/modules/integrations/`: adaptadores server-only por origen, transporte HTTP y validación.
- `src/modules/finance/`: normalización, reglas financieras y consolidación.
- `src/lib/`: utilidades transversales estrictamente necesarias.
- `tests/unit/`, `tests/integration/` y `tests/e2e/`: validaciones incrementales.

No crear carpetas vacías ni arquitectura ceremonial.

## 5. Integraciones existentes y faltantes

**RFN POS — implementado:** API autenticada por `x-api-key`, con GET `/api/consolidado/identidad`, `/resumen`, `/gastos` y `/ventas`. Los importes monetarios viajan como strings en USD. `/resumen` devuelve cobros, gastos, compras, egresos y resultado neto; `/gastos` lista solo gastos, **no compras**; `/ventas` lista ventas y su cobrado acumulado, **no pagos individuales con fecha**. La comparación mensual se obtiene consultando `/resumen` por cada rango calendario; no requiere un endpoint histórico nuevo.

**Ferraro Detail y PPF House — APIs implementadas:** GET `/api/consolidado/identidad`, `/resumen` y `/egresos`, autenticadas por `x-api-key`. `/resumen` informa cobros netos de clientes, devoluciones y reversiones, excluyendo ingresos manuales. `/egresos` informa totales de compras, gastos manuales, sueldos pagados (`SALARY_PAYMENT`) y egresos, incluyendo compensaciones por reversión; movimientos paginados. Los adaptadores existentes validan identidad, USD, período argentino, consistencia monetaria y paginación. El ledger de origen conserva `INFLOW`, `OUTFLOW`, `CUSTOMER_PAYMENT`, `CUSTOMER_REFUND`, `PURCHASE`, `MANUAL_INCOME`, `MANUAL_EXPENSE`, `SALARY_PAYMENT` y `REVERSAL`.

**Presentación normalizada:** `src/modules/finance/summary.server.ts` entrega por empresa cobros, egresos, saldo neto, compras, sueldos y otros gastos, con estados completo, parcial o no disponible. Ferraro/PPF conservan cobros si falla egresos y viceversa; el saldo exige ambos. RFN utiliza su resultado neto validado; sueldos separados son `null` porque ya están incluidos en gastos operativos. Inicio y fichas usan el mismo componente. Empresas verifica datos financieros del mes argentino actual.

**Consolidado:** sumar exclusivamente strings validados mediante BigInt en centavos. Solo es completo con las tres empresas; ante fallos se indica «Consolidado incompleto», empresas faltantes y «Subtotal de empresas disponibles», incluyendo únicamente empresas con cobros, egresos y saldo válidos. Sin empresas completas no hay importe de subtotal. Saldo neto = cobros netos de clientes − egresos registrados; no representa ganancia ni saldo bancario conciliado. Ingresos manuales excluidos y transferencias sin deduplicación automática.

**Comparación mensual:** barras agrupadas con Recharts 3.10.1 en componente cliente aislado, seis meses calendario hasta el mes de `hasta` (acumulado disponible del mes en curso), independientes del rango parcial del resumen. Series fijas Ferraro, PPF y RFN; selector local de cobros, egresos y saldo. Carga server-only en Server Component asíncrono y Suspense. Máximo tres empresas concurrentes; seis meses secuenciales por empresa, cobros/egresos del mismo mes en paralelo. Reutilizar el resumen ya consultado si coincide el rango mensual, incluso ante fallo; sin reintentos inmediatos, historiales completos ni páginas adicionales. Valores ausentes son `null`, nunca cero. Tooltip y tabla accesible conservan strings exactos; `number` se usa solo para coordenadas. Sin caché persistente.

Ningún adaptador debe inventar un endpoint ni simular que una fuente devuelve información inexistente. Para nuevos endpoints en las aplicaciones de origen, elaborar cambios mínimos y obtener autorización antes de modificar esos repositorios. No usar las APIs de una empresa para modificar sus datos.

Repositorios de referencia:
- [Ferraro Manager](https://github.com/Broco-Solutions/ferraro-manager): `package.json`, `src/design-system/`, `src/components/patterns/page.tsx`, `src/modules/finance/application/finance-service.ts`, `src/modules/dashboard/application/dashboard-service.ts`, `docs/DECISIONS.md`.
- [PPF House](https://github.com/Broco-Solutions/ppfhouse): mismas referencias, más `src/config/brand.ts` y tokens propios.
- [RFN POS](https://github.com/Broco-Solutions/rfn-pos): `API-CONSOLIDACION.md`, `sistema/lib/api-consolidacion.ts` y `sistema/lib/metricas.ts`.
- La [demo](https://github.com/Broco-Solutions/multiempresa-demo-ferraro) es ilustrativa: no es fuente financiera ni alcance aprobado.

## 6. Semántica financiera obligatoria

- **USD es la moneda de consolidación.** Conservar origen ARS/USD y tipo de cambio histórico cuando esté disponible. Nunca reconvertir montos históricos con una cotización actual.
- Un cobro es distinto de una venta facturada, una reserva y una seña; los cobros parciales se cuentan en el período de su cobro, no en la fecha de la venta.
- Los **egresos** incluyen los gastos registrados de las tres empresas, sus compras y sueldos conforme a las reglas efectivamente usadas por cada fuente; no sumar compras o sueldos nuevamente si ya generan asientos financieros.
- Separar devoluciones, anulaciones y reversiones de los gastos operativos. El saldo neto se deriva de las entradas y salidas compatibles; **no se presenta como ganancia**.
- En RFN, las compras `RECIBIDA` entran en los egresos del dashboard, aunque el modelo no registre una confirmación independiente de pago bancario. No llamarlo «efectivamente pagado» sin revisión funcional.
- Antes de fijar el total principal de «Ingresos», acordar cómo tratar `MANUAL_INCOME` frente a cobros de clientes. No mezclar ambos silenciosamente.
- Identificar posibles transferencias entre empresas antes de consolidarlas. Si no se pueden distinguir, informar la limitación; no inventar deduplicación.
- Usar dinero como **strings decimales de USD** en los límites de la aplicación; para sumas exactas de los importes de dos decimales usar **BigInt en centavos** u otra representación decimal exacta justificada. Nunca usar floats JS para sumas financieras. Convertir a `number` solo para representación visual de gráficos, después de calcular los totales exactos.
- Períodos con calendario y zona `America/Argentina/Buenos_Aires`. Respetar cómo cada fuente interpreta bordes inclusivos/exclusivos y normalizar sin corrimientos de día ni doble conteo.
- El detalle unificado retiene `empresaId` + ID de origen y clasificación original; las categorías de cada empresa **no deben forzarse a ser idénticas**.

## 7. Seguridad, datos y disponibilidad

- Solo consultas GET de lectura a las fuentes. Secretos y URLs privadas en variables de servidor; **nunca** en `NEXT_PUBLIC_*`, HTML, JS del navegador, logs o Git.
- Ejemplos de nombres de configuración **del consumidor**, aún no creados: `RFN_API_BASE_URL`, `RFN_API_KEY`, `FERRARO_API_BASE_URL`, `FERRARO_API_KEY`, `PPF_API_BASE_URL` y `PPF_API_KEY`. No confundirlos con `CONSOLIDADO_API_KEY`, la variable ya utilizada dentro de RFN.
- No trasladar información personal no requerida: clientes, vendedores, teléfonos, correos o nombres individuales en movimientos de sueldos.
- Acceso al dashboard únicamente para el dueño inicialmente. **Autenticación del dueño:** Better Auth 1.7.7, Argon2id, un solo propietario activo, sin registro público, sesiones persistentes revocables con vencimiento absoluto de 12 horas y límite persistente compartido de cinco intentos por 60 segundos. Cookies HttpOnly, Secure en producción y SameSite=Lax. Proxy inicial más verificación real de sesión en cada página y operación financiera; sin caché de sesión ni caché financiera. Sin configuración o almacenamiento válido no se consulta RFN. No crear SSO ni un sistema de usuarios complejo. No exponer datos financieros públicamente ni desplegar la integración real sin protección de acceso verificada.
- Consultas privadas sin caché pública: `cache: 'no-store'` o equivalente, protección antiindexación, errores sin filtrar secretos.
- Ante 401, 403, timeout, dato inválido o caída de una empresa, **mostrar empresa afectada y estado «Consolidado incompleto»**. Nunca convertir una falla en USD 0 ni presentar la suma parcial como total completo.
- No crear cron jobs, colas, webhooks, sincronización ni caché persistente sin una necesidad comprobada.

## 8. Calidad y criterios de aceptación

Antes de cada cambio Codex debe inspeccionar el código actualizado del repositorio afectado y consultar las referencias necesarias. Mantener modificaciones pequeñas, reversibles y localizadas.

- Compilar: `pnpm lint`, `pnpm typecheck`, `pnpm build`.
- Testear reglas de dinero, reversiones, categorías, períodos argentinos y fallas parciales mediante Vitest.
- Testear cada adaptador con respuestas HTTP controladas (401/403/500, timeout, datos inválidos, meses vacíos, paginación, monedas) y sin exponer claves.
- Probar navegación y comportamiento responsive con Playwright cuando existan las pantallas.
- Contrastar los importes reales con las aplicaciones fuente antes de declararlos correctos.
- No afirmar que una integración está disponible si solo se leyó el código: hace falta validar sus endpoints y permisos en el entorno correspondiente.
- Al entregar: indicar archivos cambiados, pruebas ejecutadas, diferencias contra la fuente y decisiones abiertas. No modificar fuentes, secretos o despliegues sin autorización.

## 9. Decisiones todavía abiertas

1. Aprovisionamiento autorizado del PostgreSQL exclusivo de autenticación, esquema y primer propietario (mecanismo implementado; configuración productiva pendiente).
2. Entorno de despliegue y dominio de Multi-Empresa.
3. Definición final de ingresos totales: cobros de clientes frente a ingresos manuales.
4. Tratamiento de transferencias entre empresas y discrepancias entre egresos contables y pagos reales.
5. Extensión mínima de los endpoints faltantes para detalles todavía no expuestos, como pagos individuales de RFN; la comparación mensual usa resúmenes por rango existentes.

Estos pendientes **no bloquean la creación del esqueleto visual**, pero sí impiden afirmar que un tablero muestra totales reales y consolidados validados.

**Regla para Codex:** no tratar una propuesta, un dato simulado ni una ruta futura como implementación existente. Si una tarea contradice este documento, señalarlo antes de programar y proponer el cambio mínimo.

## 10. Integración RFN protegida

El área privada mantiene sus URL mediante el route group `(private)`; `/login` queda fuera de AppShell. El cliente RFN existente es server-only y exige sesión antes de consultar identidad, resumen o gastos. Las respuestas deben coincidir exactamente con los límites inclusivos del calendario argentino (UTC-03), identidad y USD; no se acepta la tolerancia anterior de 12 horas. No se siguen redirecciones hacia otra URL con la clave. Los importes se verifican con BigInt en centavos. Cada empresa solo se muestra conectada cuando sus indicadores financieros requeridos están validados; los totales de las tres empresas se publican únicamente con cobertura completa. Ante fallos se identifica el consolidado incompleto y el subtotal disponible. No se muestran conceptos libres de gastos por posible contenido personal. Compras solo agregadas; sin historial de pagos ni evolución inventados; la comparación mensual utiliza exclusivamente resúmenes reales por rango. La conexión y conciliación productivas no están verificadas.

## 11. Panel ejecutivo de Inicio

Inicio utiliza por defecto el primer día del mes hasta hoy en Argentina; las otras páginas conservan su período predeterminado. Los enlaces Este mes, Mes anterior, Últimos 3 meses y Últimos 6 meses usan únicamente `desde` y `hasta`, conviven con el formulario manual y señalan los rangos personalizados. Fechas calculadas por calendario UTC a partir de la fecha argentina y validadas con `readPeriod()` antes de consultar fuentes.

La comparación anterior carga una sola vez `loadFinancialSummaries()` para las tres empresas en un Server Component asíncrono bajo Suspense independiente. Este mes compara el mismo tramo del mes anterior, limitado a sus días reales y marcado no equivalente si es más corto; Mes anterior compara meses completos. Los demás rangos comparan el tramo inmediatamente anterior de igual cantidad inclusiva de días. Diferencias y porcentajes usan BigInt en centavos; porcentajes con un decimal, redondeo de mitades alejándose de cero, sin porcentaje convencional con base no positiva o períodos no equivalentes. Se exige cobertura completa de cobros, egresos y saldo en las tres empresas en ambos períodos; de otro modo se identifican fuentes faltantes sin publicar variación global.

La participación usa exclusivamente los cobros actuales ya validados, sin consultas adicionales. Barras CSS horizontales en orden Ferraro, PPF, RFN y colores fijos. Exige tres cobros no negativos y total positivo; de otro modo conserva importes conocidos y explica la indisponibilidad sin barras ni porcentajes. Reparto de restos mayores en décimas porcentuales, desempate por orden de empresa, para sumar exactamente 100,0 %. El gráfico mensual, adaptadores, seguridad y semántica financiera existentes permanecen vigentes.


### Carga progresiva y consultas por solicitud (2026-11-06)

Inicio valida la sesión real y los filtros antes de presentar encabezado y controles. El contenido financiero se resuelve en un Server Component asíncrono bajo Suspense con clave `desde:hasta`; muestra «Cargando información financiera…» con `role="status"` y `aria-busy`, sin importes de ejemplo. Una vez listos los resúmenes actuales, el gráfico y la comparación anterior cargan bajo límites Suspense independientes: ninguno bloquea los KPIs ni al otro. Los fallos de fuente mantienen los resultados parciales existentes; los errores de autorización se propagan.

Orden de Inicio, después del encabezado y filtros: **Resumen consolidado → Comparación mensual → Comparación con el período anterior → Participación de las empresas → Resumen por empresa → Navegación financiera**. Se conservan todas las métricas, aclaraciones, seis meses y controles del gráfico.

`(private)/loading.tsx` utiliza la carga nativa de App Router dentro del layout protegido y también exige sesión antes de mostrar su contenido. Los cambios de parámetros en la misma ruta tienen su propio Suspense con clave de período. El formulario manual de Inicio usaba GET con recarga completa: ahora utiliza `next/form` para conservar el layout durante la navegación, con `prefetch={false}`; los filtros rápidos también conservan `prefetch={false}`. No se agregan consultas especulativas por hover ni componentes cliente propios.

Los resúmenes se memoizan mediante `cache()` de React exclusivamente durante el render del servidor, con argumentos primitivos `empresaId`, `desde`, `hasta`. La API pública vuelve a exigir `requireOwner()` y validar el período antes de acceder al resultado memoizado. Se comparten promesas y resultados con estados parciales o `null`, sin reintentos inmediatos de fallos. Las identidades validadas de Ferraro, PPF y RFN se reutilizan durante ese mismo render, incluyendo rechazos. Cada respuesta financiera sigue validándose individualmente (empresa, versión, USD, fechas e importes); se mantienen HTTPS, claves privadas, GET, `no-store`, redirecciones rechazadas y timeout de 10 segundos. No hay persistencia ni reutilización entre solicitudes HTTP o sesiones; fuera de un contexto RSC apto no se presupone deduplicación. Se mantienen los tres trabajadores históricos, sus seis meses secuenciales y cobros/egresos paralelos por mes.

Mediciones antes (`9104502`) y después, con `fetch` controlado, tres fuentes configuradas y respuestas válidas en un render RSC real (`tests/unit/dashboard-performance.test.ts`), sin credenciales productivas:

| Escenario / solicitudes HTTP | Identidad antes → después | Resumen antes → después | Egresos antes → después | Total antes → después | Reducción total |
| --- | --- | --- | --- | --- | --- |
| Inicio parcial, 01–06/11/2026 | 24 → 3 | 24 → 24 | 16 → 16 | 64 → 43 | 21 |
| Inicio mes anterior completo, octubre 2026 | 21 → 3 | 21 → 18 | 14 → 12 | 56 → 33 | 23 |
| Ingresos, solicitud nueva posterior a Inicio | 3 → 3 | 3 → 3 | 0 → 0 | 6 → 6 | 0 |
| Gastos, solicitud nueva posterior a Inicio, todas las empresas | 1 → 1 | 1 → 1 | 2 → 2 | 4 → 4 | 0 |

En octubre se reutilizaba explícitamente el mes actual del resumen en el gráfico (tres resultados); ahora también se reutilizan los tres resúmenes de septiembre que coinciden con la comparación anterior. En el rango parcial no coinciden los períodos y no se omite ninguno. Inicio parcial seguido de Ingresos suma 70 → 49 HTTP; seguido de Gastos, 68 → 47. Dos objetos equivalentes para Ferraro ejecutan 6 → 3 HTTP en un mismo render; un render nuevo vuelve a ejecutar las tres consultas. La prueba también verifica identidades de períodos diferentes, fallos sin reintento y autorización rechazada sin consultar fuentes.

Las pruebas de navegador de componentes y estados de carga cubren 1440, 768 y 390 px, sin desbordamiento horizontal. La suite completa de navegación con login y revocación exige `AUTH_TEST_DATABASE_URL` en un PostgreSQL local aislado; no estaba configurado durante esta optimización y no se creó ninguna base. Sus casos quedan disponibles en `tests/navigation.spec.ts`. La conciliación y la latencia productivas continúan sin verificarse.

Tiempos controlados de emisión RSC (una ejecución local de cada versión, latencia artificial de 20 ms por HTTP, autorización y componentes de presentación aislados en el arnés; no son tiempos productivos ni mediciones de pintura del navegador):

| Hito de Inicio parcial | Antes | Después |
| --- | --- | --- |
| Encabezado y filtros | 56 ms | 4 ms |
| Estado de carga propio de Inicio | No existía | 4 ms |
| KPIs principales | 57 ms | 60 ms |
| Datos del gráfico histórico emitidos | 322 ms | 209 ms |

Con un resumen histórico demorado artificialmente a 250 ms, los KPIs se emitieron a los 67 ms, la comparación anterior a los 102 ms y el gráfico a los 446 ms. Al demorar la comparación anterior a 250 ms, el gráfico se emitió a los 212 ms y la comparación a los 333 ms. Los tiempos varían con la carga del equipo; las aserciones automatizadas comprueban orden de resolución e independencia, además de cantidades exactas de HTTP. La aparición visual durante la navegación real queda pendiente del entorno E2E autenticado.
