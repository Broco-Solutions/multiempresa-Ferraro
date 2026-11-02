import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { testDatabaseUrl, ownerEmail, testSecret } from './auth';
const metadata = { empresaId: 'rfn-argentina', empresaNombre: 'RFN Argentina', moneda: 'USD', version: 1 };
const server = createServer((req, res) => {
  const url = new URL(req.url!, 'http://127.0.0.1:4318');
  if (req.headers['x-api-key'] !== 'isolated-rfn-key-at-least-32-characters-long') { res.writeHead(401).end(); return; }
  res.setHeader('Content-Type', 'application/json');
  if (url.pathname.endsWith('/identidad')) { res.end(JSON.stringify({ ...metadata, endpoints: ['GET /api/consolidado/resumen', 'GET /api/consolidado/gastos'] })); return; }
  const desde = url.searchParams.get('desde')!;
  const hasta = url.searchParams.get('hasta')!;
  const periodo = { desde: new Date(desde + 'T00:00:00-03:00').toISOString(), hasta: new Date(hasta + 'T23:59:59.999-03:00').toISOString() };
  // Fixtures are only served by the isolated E2E process, never part of the app.
  if (desde === '2026-01-01') { res.writeHead(403).end(JSON.stringify({ error: 'Fixture failure' })); return; }
  if (url.pathname.endsWith('/resumen')) {
    res.end(JSON.stringify({ ...metadata, periodo, totales: { ventasConfirmadas: { cantidad: 2, monto: '100' }, reservasActivas: { cantidad: 0, monto: '0', nota: 'Fixture' }, cobros: '100.00', gastos: '30.10', compras: '10.20', egresos: '40.30', resultadoNeto: '59.70' }, gastosPorCategoria: [{ categoria: 'Sueldos', monto: '30.10' }], alertasStock: { stockBajo: 0, sinStock: 0 } })); return;
  }
  const pagina = Number(url.searchParams.get('pagina'));
  res.end(JSON.stringify({ ...metadata, periodo, gastos: [{ id: `fixture-${pagina}`, fecha: periodo.desde, concepto: 'PERSONAL_NAME_MUST_NOT_LEAK', categoria: url.searchParams.get('categoria') || 'Sueldos', medioPago: 'Transferencia', importe: '30.10' }], totalDelFiltro: '60.20', paginacion: { total: 26, pagina, porPagina: 25, totalPaginas: 2, hayMas: pagina === 1 } }));
});
server.listen(4318, '127.0.0.1');
const child = spawn('pnpm', ['dev', '--port', '4317', '--hostname', '127.0.0.1'], { stdio: 'inherit', env: { ...process.env, AUTH_DATABASE_URL: testDatabaseUrl(), AUTH_OWNER_EMAIL: ownerEmail, BETTER_AUTH_SECRET: testSecret, BETTER_AUTH_URL: 'http://127.0.0.1:4317', RFN_API_BASE_URL: 'http://127.0.0.1:4318/', RFN_API_KEY: 'isolated-rfn-key-at-least-32-characters-long', RFN_EXPECTED_COMPANY_ID: 'rfn-argentina' } });
function stop() { child.kill('SIGTERM'); server.close(); }
process.on('SIGTERM', stop); process.on('SIGINT', stop);
child.on('exit', code => { server.close(); process.exit(code ?? 0); });
