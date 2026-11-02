# Instrucciones para Codex — Multi-Empresa Ferraro

Antes de analizar, planificar, modificar o crear código en este repositorio, **leer y respetar [ARCHITECTURE.md](./ARCHITECTURE.md)** por completo.

- Revisar primero el código y la rama `main` actualizados; no inventar rutas, funciones, endpoints, dependencias ni decisiones.
- Tomar Ferraro Detail (`Broco-Solutions/ferraro-manager`) y PPF House (`Broco-Solutions/ppfhouse`) como referentes de stack, patrones y diseño; **no clonar sus aplicaciones completas**.
- Multi-Empresa es una cuarta aplicación independiente, de consulta financiera y solo lectura, que consume APIs de tres fuentes. Mantener bases, secretos y despliegues separados.
- Mantener el dashboard principal sencillo y poner los detalles en secciones específicas.
- No incluir características de la demo ni datos financieros simulados como si fueran reales.
- Preservar la semántica financiera por empresa: USD canónico, períodos argentinos, cobros/gastos/compras/sueldos/reversiones sin duplicar importes, precisión decimal.
- Todas las credenciales y consultas a APIs originales quedan del lado servidor. Proteger datos financieros; no desarrollar un login falso ni implementar SSO o base de datos por defecto.
- Limitar cada tarea a lo pedido. No modificar los repositorios fuente ni despliegues sin autorización explícita.
- Validar con lint, typecheck, build y pruebas relevantes. Comunicar las decisiones abiertas o los impedimentos antes de asumirlos.

Si una instrucción nueva contradice `ARCHITECTURE.md`, señalar la contradicción y pedir una decisión antes de programar.
