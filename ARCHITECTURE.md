# Arquitectura — Multi-Empresa Ferraro

**Versión:** 1.0 — línea base técnica de la primera implementación (2026-11-02).
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

**No crear PostgreSQL, Prisma ni almacenamiento persistente de movimientos en Multi-Empresa inicialmente.** Los sistemas de origen ya mantienen sus bases. Revisar esa decisión solo si surge un requisito real.

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

Organización **propuesta, todavía no implementada** (ajustar solo si el código inicial lo requiere):

- `src/app/`: rutas del dashboard y páginas de detalle.
- `src/components/` y `src/design-system/`: componentes y estilos reutilizables.
- `src/modules/integrations/`: adaptadores server-only por origen, transporte HTTP y validación.
- `src/modules/finance/`: normalización, reglas financieras y consolidación.
- `src/lib/`: utilidades transversales estrictamente necesarias.
- `tests/unit/`, `tests/integration/` y `tests/e2e/`: validaciones incrementales.

No crear carpetas vacías ni arquitectura ceremonial.

## 5. Integraciones existentes y faltantes

**RFN POS — implementado:** API autenticada por `x-api-key`, con GET `/api/consolidado/identidad`, `/resumen`, `/gastos` y `/ventas`. Los importes monetarios viajan como strings en USD. `/resumen` devuelve cobros, gastos, compras, egresos y resultado neto; `/gastos` lista solo gastos, **no compras**; `/ventas` lista ventas y su cobrado acumulado, **no pagos individuales con fecha**. La evolución mensual existe internamente pero no se expone aún por esa API.

**Ferraro Detail y PPF House — implementado internamente:** ledger `FinancialEntry` con `INFLOW`, `OUTFLOW` y tipos `CUSTOMER_PAYMENT`, `CUSTOMER_REFUND`, `PURCHASE`, `MANUAL_INCOME`, `MANUAL_EXPENSE`, `SALARY_PAYMENT` y `REVERSAL`. `listFinancialEntries` y las métricas del dashboard existen como servicios internos. **No hay API de consolidación pública/authenticated para Multi-Empresa todavía**. Reutilizar la misma lógica al diseñar endpoints de solo lectura, sin duplicar servicios o modelos.

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
- Acceso al dashboard únicamente para el dueño inicialmente. **Mecanismo de autenticación pendiente**; no crear un login ficticio, SSO ni un sistema de usuarios complejo. No exponer datos financieros públicamente ni desplegar la integración real sin protección de acceso verificada.
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

1. Mecanismo concreto de autenticación del dueño.
2. Entorno de despliegue y dominio de Multi-Empresa.
3. Definición final de ingresos totales: cobros de clientes frente a ingresos manuales.
4. Tratamiento de transferencias entre empresas y discrepancias entre egresos contables y pagos reales.
5. Extensión mínima de los endpoints faltantes para la vista de detalle e histórico.

Estos pendientes **no bloquean la creación del esqueleto visual**, pero sí impiden afirmar que un tablero muestra totales reales y consolidados validados.

**Regla para Codex:** no tratar una propuesta, un dato simulado ni una ruta futura como implementación existente. Si una tarea contradice este documento, señalarlo antes de programar y proponer el cambio mínimo.
