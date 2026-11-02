# Multi-Empresa Ferraro

Aplicación independiente de consulta financiera para Ferraro Detail, PPF House y RFN Argentina. Esta primera versión contiene solo estructura visual y navegación: las fuentes todavía no están conectadas y no se muestran importes financieros.

## Desarrollo local

Requisitos: Node.js 24 y pnpm 11.9.0 (Corepack puede activar la versión indicada en `package.json`).

```sh
corepack enable
pnpm install
pnpm dev
```

Abrir http://localhost:3000. Para validar:

```sh
pnpm lint
pnpm typecheck
pnpm build
pnpm exec playwright install chromium
pnpm test
```

La autenticación del dueño y las integraciones se definirán antes de habilitar datos reales o publicar para uso productivo. Consultar `ARCHITECTURE.md` para las decisiones y límites financieros y de seguridad.
