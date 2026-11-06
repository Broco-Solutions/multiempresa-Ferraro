import { requireOwner } from '@/modules/identity/session';
import { companies } from '@/config/companies';
import { PageHeader, styles } from '@/components/patterns/page';
import { InvalidFilters, formatUsd } from '@/components/patterns/rfn-finance';
import { readPeriod, argentinaTimeZone, type SearchParams } from '@/modules/integrations/rfn/period';
import { loadFerraroReceipts, loadPpfReceipts } from '@/modules/integrations/customer-receipts/client.server';
import { loadRfnSummary } from '@/modules/integrations/rfn/finance.server';
import { centsToUsd, usdToCents } from '@/modules/integrations/rfn/money';

export default async function IncomePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireOwner();
  const params = await searchParams;
  const company = params.empresa ?? 'todas';
  let period: ReturnType<typeof readPeriod>;
  try {
    period = readPeriod(params);
    if (typeof company !== 'string' || (company !== 'todas' && !companies.some(value => value.id === company))) throw new Error('INVALID_FILTER');
  } catch { return <InvalidFilters/>; }

  const sources = await Promise.all(companies.filter(value => company === 'todas' || value.id === company).map(async value => {
    if (value.id === 'rfn-argentina') {
      const result = await loadRfnSummary(period);
      return { ...value, total: result.ok ? result.summary.totales.cobros : null, message: result.ok ? null : result.message };
    }
    const result = await (value.id === 'ferraro-detail' ? loadFerraroReceipts(period) : loadPpfReceipts(period));
    return { ...value, total: result.ok ? result.cobros : null, message: result.ok ? null : result.message };
  }));
  const missing = sources.filter(source => source.total === null);
  const available = sources.filter(source => source.total !== null);
  const total = available.length ? centsToUsd(available.reduce((sum, source) => sum + usdToCents(source.total!), 0n)) : null;
  const allCompanies = company === 'todas';

  return <div className={styles.page}>
    <PageHeader title="Ingresos" description="Consultá los cobros de Ferraro Detail, PPF House y RFN Argentina."/>
    <form className={styles.filters} method="get" key={`${period.desde}-${period.hasta}-${company}`}>
      <label htmlFor="ingresos-desde">Desde<input id="ingresos-desde" name="desde" type="date" defaultValue={period.desde} required/></label>
      <label htmlFor="ingresos-hasta">Hasta<input id="ingresos-hasta" name="hasta" type="date" defaultValue={period.hasta} required/></label>
      <label htmlFor="ingresos-empresa">Empresa<select aria-label="Empresa" id="ingresos-empresa" name="empresa" defaultValue={company}><option value="todas">Todas las empresas</option>{companies.map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</select></label>
      <button type="submit">Consultar</button>
    </form>
    <section className={styles.panel} aria-label="Total de cobros del período">
      <div className={styles.panelHead}><div><h2>{allCompanies ? 'Cobros del conjunto' : `Cobros de ${sources[0]!.name}`}</h2><p>Período consultado: {period.desde} al {period.hasta} · {argentinaTimeZone}</p></div></div>
      {missing.length ? <div className={styles.notice} role="status"><div><strong>{allCompanies ? 'Consolidado incompleto' : 'Consulta no disponible'}</strong><p>Sin cobros validados de: {missing.map(source => source.name).join(', ')}.</p></div></div> : null}
      <div className={styles.metric}><h3>{allCompanies ? (missing.length ? 'Subtotal de empresas disponibles' : 'Total de las tres empresas') : 'Total de cobros del período'}</h3><strong>{total === null ? 'No disponible' : formatUsd(total)}</strong></div>
      <p className={styles.footnote}>Ferraro y PPF: cobros netos de clientes, con devoluciones y reversiones; se excluyen ingresos manuales y ventas no cobradas. RFN: cobros informados por su API financiera. {allCompanies ? 'El total incluye únicamente cobros validados. No se compensan transferencias entre empresas sin identificar.' : null}</p>
    </section>
    <section aria-label="Desglose por empresa">
      <div className={styles.sectionHead}><h2>Desglose por empresa</h2></div>
      <div className={styles.companyGrid}>{sources.map(source => <article className={`${styles.panel} ${styles.financialCard}`} key={source.id}>
        <div className={styles.summaryHeader}><h2>{source.name}</h2><span className={styles.badge}>{source.total === null ? 'No disponible' : 'Conectada'}</span></div>
        <dl className={styles.companyIndicators}><div className={styles.primaryIndicator}><dt>{source.id === 'rfn-argentina' ? 'Cobros informados por RFN' : 'Cobros netos de clientes'}</dt><dd>{source.total === null ? 'No disponible' : formatUsd(source.total)}</dd></div></dl>
        {source.message ? <p role="status">{source.message}</p> : null}
      </article>)}</div>
    </section>
  </div>;
}
