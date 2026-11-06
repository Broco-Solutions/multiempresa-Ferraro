import { expect, it } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

// A separate process is essential: React.cache only memoizes inside an RSC render.
// Only session and presentation boundaries are replaced; adapters, validation,
// summaries, periods and HTTP counts use the actual application code.
const harness = String.raw`
import { registerHooks, createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
const root = process.cwd();
const require = createRequire(root + '/package.json');
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'react' || specifier.startsWith('react/') || specifier === 'react-dom') return { url: pathToFileURL(require.resolve(specifier)).href, shortCircuit: true };
    if (specifier === 'next/form') return { url: 'mock:form', shortCircuit: true };
    if (specifier === 'next/link') return { url: 'mock:link', shortCircuit: true };
    if (specifier.includes('identity/session')) return { url: 'mock:session', shortCircuit: true };
    if (specifier.includes('patterns/comparison-chart')) return { url: 'mock:chart', shortCircuit: true };
    if (specifier.endsWith('.css')) return { url: 'mock:css', shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    const sources = {
      'mock:session': 'export async function requireOwner() { if(globalThis.denied) throw Error("REDIRECT"); return {user:{id:"test"}} }',
      'mock:link': 'import {createElement} from "react"; export default function Link({children,...props}) { delete props.prefetch; return createElement("a",props,children) }',
      'mock:css': 'export default {}',
      'mock:form': 'import {createElement} from "react"; export default function Form({children,prefetch,...props}) { return createElement("form",props,children) }',
      'mock:chart': 'import {createElement} from "react"; export function ComparisonChart({months}) { return createElement("section",{"aria-label":"Comparación mensual"},"HISTORY_DONE",JSON.stringify(months)) }',
    };
    if (url in sources) return { format: 'module', source: sources[url], shortCircuit: true };
    return next(url, context);
  }
});
const {createElement, Suspense} = await import('react');
const {renderToPipeableStream} = require('next/dist/compiled/react-server-dom-webpack/server.node');
const {PassThrough} = await import('node:stream');
const {default:Home} = await import(root + '/src/app/(private)/page.tsx');
const {default:Income} = await import(root + '/src/app/(private)/ingresos/page.tsx');
const {default:Expenses} = await import(root + '/src/app/(private)/gastos/page.tsx');
const {loadFinancialSummaries,loadCompanySummary} = await import(root + '/src/modules/finance/summary.server.ts');
const counters = {identidad:0,resumen:0,egresos:0};
let failed = false, latency = 0, slow = '';
for (const prefix of ['FERRARO','PPF','RFN']) {
  process.env[prefix+'_API_BASE_URL']='https://'+prefix.toLowerCase()+'.test/';
  process.env[prefix+'_API_KEY']='isolated-test-key-'.repeat(3);
}
globalThis.fetch = async (target, options) => {
  const url = new URL(target), resource=url.pathname.split('/').at(-1);
  counters[resource]++;
  if(options.cache!=='no-store' || options.method!=='GET' || options.redirect!=='error') throw Error('Unsafe transport');
  const delay = resource==='resumen' && (slow==='history' ? url.searchParams.get('desde')==='2026-06-01' : slow==='previous' && url.searchParams.get('hasta')==='2026-10-06') ? 250 : latency;
  if(delay) await new Promise(resolve=>setTimeout(resolve,delay));
  if(failed) return Response.json({}, {status:503});
  const empresaId = {'ferraro.test':'ferraro-detail','ppf.test':'ppf-house','rfn.test':'rfn-argentina'}[url.hostname];
  const identity={version:1,empresaId,moneda:'USD'};
  const rfn=empresaId==='rfn-argentina';
  const meta=rfn?{...identity,empresaNombre:'RFN Argentina'}:identity;
  if(resource==='identidad') return Response.json(rfn?{...meta,endpoints:['GET /api/consolidado/resumen']}:meta);
  const desde=url.searchParams.get('desde'), hasta=url.searchParams.get('hasta');
  const periodo={desde:new Date(desde+'T00:00:00-03:00').toISOString(),hasta:new Date(hasta+'T23:59:59.999-03:00').toISOString()};
  if(resource==='egresos') return Response.json({...meta,periodo,totales:{compras:'0.00',gastosManuales:'0.00',sueldosPagados:'0.00',egresos:'0.00'},movimientos:[],paginacion:{pagina:1,porPagina:25,total:0,totalPaginas:1,hayMas:false}});
  if(!rfn) return Response.json({...meta,periodo,cobros:'0.10',movimientos:1});
  return Response.json({...meta,periodo,totales:{ventasConfirmadas:{cantidad:1,monto:'0.10'},reservasActivas:{cantidad:0,monto:'0',nota:'Test'},cobros:'0.10',gastos:'0.00',compras:'0.00',egresos:'0.00',resultadoNeto:'0.10'},gastosPorCategoria:[],alertasStock:{stockBajo:0,sinStock:0}});
};
async function render(Component,params={desde:'2026-11-01',hasta:'2026-11-06'}) {
  Object.keys(counters).forEach(k=>counters[k]=0);
  const started=performance.now(), times={}, errors=[];
  let text='';
  const stream=new PassThrough();
  stream.on('data',chunk=>{
    text+=chunk;
    for(const [key,marker] of Object.entries({shell:'Resumen financiero',loading:'Cargando información financiera',kpis:'USD 0,30',history:'HISTORY_DONE',previous:'Actual: '})) if(times[key]===undefined && text.includes(marker)) times[key]=Math.round(performance.now()-started);
  });
  await new Promise(resolve=>{
    stream.on('end',resolve);
    renderToPipeableStream(createElement(Suspense,{fallback:createElement('p',null,'ROUTE_TEST_FALLBACK')},createElement(Component,{searchParams:Promise.resolve(params)})),{}, {onError:e=>{errors.push(e.message);return 'redacted'}}).pipe(stream);
  });
  return {counts:{...counters},times,errors,text};
}
async function IdentityPeriods() {
  const data = await Promise.all(['ferraro-detail','ppf-house','rfn-argentina'].flatMap(id => [
    loadCompanySummary(id,{desde:'2026-10-01',hasta:'2026-10-31'}),
    loadCompanySummary(id,{desde:'2026-09-01',hasta:'2026-09-30'}),
  ]));
  return createElement('p',null,JSON.stringify(data));
}
const result={};
for(const [name,params] of Object.entries({partial:{desde:'2026-11-01',hasta:'2026-11-06'},full:{desde:'2026-10-01',hasta:'2026-10-31'}})) result[name]=await render(Home,params);
result.income=await render(Income); result.expenses=await render(Expenses);
async function Duplicate() {
  const period={desde:'2026-10-01',hasta:'2026-10-31'};
  const [a,b]=await Promise.all([loadCompanySummary('ferraro-detail',period),loadCompanySummary('ferraro-detail',{...period})]);
  return createElement('p',null,a===b?'REUSED_RESULT':'DISTINCT_RESULTS',JSON.stringify([a,b]));
}
result.duplicate=await render(Duplicate); result.newRequest=await render(Duplicate);
result.identities=await render(IdentityPeriods);
failed=true; result.failed=await render(Duplicate); result.failedIdentities=await render(IdentityPeriods); failed=false;
globalThis.denied=true; result.denied=await render(Duplicate); result.deniedHome=await render(Home); globalThis.denied=false;
latency=20; result.timed=await render(Home);
slow='history'; result.slowHistory=await render(Home);
slow='previous'; result.slowPrevious=await render(Home);
for(const value of Object.values(result)) { value.exact=value.text.includes('USD 0,30'); value.reused=value.text.includes('REUSED_RESULT'); value.privateShell=value.text.includes('Resumen financiero'); delete value.text; }
console.log('MEASUREMENTS '+JSON.stringify(result));
`;

it('measures HTTP counts, request isolation and progressive rendering in a real RSC renderer', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'multiempresa-rsc-'));
  try {
    const script = join(directory, 'measure.mts');
    await writeFile(script, harness);
    const { stdout } = await promisify(execFile)(process.execPath, ['--conditions=react-server', '--import', import.meta.resolve('tsx'), script], { cwd: process.cwd(), timeout: 25000 });
    const result = JSON.parse(stdout.split('MEASUREMENTS ')[1]!);
    console.log('Controlled RSC measurements (20 ms per HTTP for timed):', JSON.stringify(result));
    const baseline = process.env.PERF_BASELINE === '1';
    await writeFile(join(tmpdir(), baseline ? 'multiempresa-before.json' : 'multiempresa-after.json'), JSON.stringify(result, null, 2));
    expect(result.partial.counts).toEqual({ identidad: baseline ? 24 : 3, resumen: 24, egresos: 16 });
    expect(result.full.counts).toEqual({ identidad: baseline ? 21 : 3, resumen: baseline ? 21 : 18, egresos: baseline ? 14 : 12 });
    expect(result.income.counts).toEqual({ identidad: 3, resumen: 3, egresos: 0 });
    expect(result.expenses.counts).toEqual({ identidad: 1, resumen: 1, egresos: 2 });
    for (const name of ['duplicate', 'newRequest']) expect(result[name].counts).toEqual({ identidad: baseline ? 2 : 1, resumen: baseline ? 2 : 1, egresos: baseline ? 2 : 1 });
    expect(result.identities.counts).toEqual({ identidad: baseline ? 6 : 3, resumen: 6, egresos: 4 });
    expect(result.failedIdentities.counts).toEqual({ identidad: baseline ? 6 : 3, resumen: 0, egresos: 4 });
    expect(result.failed.counts).toEqual({ identidad: baseline ? 2 : 1, resumen: 0, egresos: baseline ? 2 : 1 });
    expect(result.denied.counts).toEqual({ identidad: 0, resumen: 0, egresos: 0 });
    expect(result.denied.errors).toEqual(['REDIRECT']);
    expect(result.deniedHome.errors).toEqual(['REDIRECT']);
    expect(result.deniedHome.privateShell).toBe(false);
    expect(result.deniedHome.counts).toEqual({ identidad: 0, resumen: 0, egresos: 0 });
    expect(result.duplicate.reused).toBe(!baseline);
    for (const name of ['partial','full','timed','slowHistory','slowPrevious']) {
      expect(result[name].exact).toBe(true);
      expect(result[name].errors).toEqual([]);
    }
    expect(result.timed.times.kpis).toBeLessThan(result.timed.times.history);
    expect(result.slowHistory.times.previous).toBeLessThan(result.slowHistory.times.history);
    expect(result.slowPrevious.times.history).toBeLessThan(result.slowPrevious.times.previous);
    if (!baseline) expect(result.timed.times.loading).toBeLessThan(result.timed.times.kpis);
  } finally { await rm(directory, { recursive: true, force: true }); }
}, 30000);
