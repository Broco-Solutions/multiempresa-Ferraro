import { test, expect, type Page } from '@playwright/test';
import { ownerEmail, ownerPassword, testPool } from './fixtures/auth';
async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(ownerEmail);
  await page.getByLabel('Contraseña', { exact: true }).fill(ownerPassword);
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page).toHaveURL('/');
}
test.beforeEach(async () => {
  const pool = testPool();
  try { await pool.query('TRUNCATE "session", "rateLimit"'); await pool.query('UPDATE "user" SET active=true'); }
  finally { await pool.end(); }
});
test('anonymous HTML and RSC requests cannot access financial pages, even with a forged cookie', async ({ page, request, context }) => {
  for (const path of ['/', '/empresas/rfn-argentina', '/empresas', '/gastos', '/ingresos', '/movimientos']) {
    await page.goto(path); await expect(page).toHaveURL('/login');
    await expect(page.getByRole('navigation')).toHaveCount(0);
    const response = await request.get(path + '?_rsc=test', { headers: { RSC: '1' }, maxRedirects: 0 });
    expect(response.status()).toBe(307); expect(await response.text()).not.toContain('100,00');
    expect(response.headers()['cache-control']).toContain('no-store');
  }
  await context.addCookies([{ name: 'better-auth.session_token', value: 'forged', domain: '127.0.0.1', path: '/' }]);
  await page.goto('/gastos'); await expect(page).toHaveURL('/login');
});
test('login has accessible controls, generic failures and rejects signup and foreign origins', async ({ page, request }, testInfo) => {
  await page.goto('/login?from=https://attacker.example');
  await expect(page.getByRole('heading', { name: 'Acceso privado' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: `/tmp/multiempresa-login-${testInfo.project.name}.png` });
  await page.getByLabel('Email', { exact: true }).fill(ownerEmail);
  await page.getByLabel('Contraseña', { exact: true }).fill('invalid-password-123');
  await page.getByRole('button', { name: 'Mostrar' }).click();
  await expect(page.getByLabel('Contraseña', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page.locator('form').getByRole('alert')).toContainText('Revisá tus credenciales');
  expect((await request.post('/api/auth/sign-up/email', { data: { email: 'other@example.test', password: ownerPassword } })).status()).toBe(404);
  expect((await request.post('/api/auth/sign-in/email', { headers: { Origin: 'https://attacker.example' }, data: { email: ownerEmail, password: ownerPassword } })).status()).toBe(403);
  await login(page); // Redirect target is fixed to this app's dashboard.
});
test('private summary, honest pending sources, exact amounts, filtering and pagination', async ({ page }) => {
  await login(page);
  await expect(page.getByText('Consolidado incompleto', { exact: true })).toBeVisible();
  await expect(page.getByText('USD 59,70', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('USD 40,30', { exact: true }).first()).toBeVisible();
  for (const [name,id] of [['Ferraro Detail','ferraro-detail'], ['PPF House','ppf-house'], ['RFN Argentina','rfn-argentina']] as const) {
    await page.goto(`/empresas/${id}`); await expect(page.getByRole('heading', { name, exact: true }).first()).toBeVisible();
    if (id === 'rfn-argentina') await expect(page.getByText('USD 10,20', { exact: true }).first()).toBeVisible();
    else await expect(page.getByText('Pendiente de configurar conexión.').first()).toBeVisible();
  }
  await page.goto('/gastos');
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByText('PERSONAL_NAME_MUST_NOT_LEAK')).toHaveCount(0);
  expect(await page.content()).not.toContain('PERSONAL_NAME_MUST_NOT_LEAK');
  const rsc = await page.request.get('/gastos?_rsc=private-check', { headers: { RSC: '1' } });
  expect(await rsc.text()).not.toContain('PERSONAL_NAME_MUST_NOT_LEAK');
  await page.getByLabel('Categoría original').fill('Sueldos'); await page.getByRole('button', { name: 'Consultar' }).click();
  await page.getByRole('link', { name: 'Siguiente' }).click();
  await expect(page.getByText('Página 2 de 2')).toBeVisible();
  await expect(page).toHaveURL(/categoria=Sueldos/);
  for (const path of ['/ingresos', '/movimientos']) { await page.goto(path); await expect(page.getByText('Sin datos disponibles')).toBeVisible(); }
  const response = await page.goto('/empresas/desconocida'); expect(response?.status()).toBe(404);
  await page.goto('/?desde=2026-01-01&hasta=2026-01-31');
  await expect(page.getByRole('status').filter({ hasText: 'rechazado' }).first()).toContainText('rechazado');
  await expect(page.getByText('USD 0,00')).toHaveCount(0);
});
test('logout revokes the server session; expired, revoked and disabled accounts lose access', async ({ page, context, request }) => {
  await login(page);
  const cookies = await context.cookies();
  expect(cookies.find(cookie => cookie.name.includes('session_token'))).toMatchObject({ httpOnly: true, sameSite: 'Lax' });
  await page.getByRole('button', { name: 'Cerrar sesión' }).click(); await expect(page).toHaveURL('/login');
  const oldCookie = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
  const revoked = await request.get('/empresas/rfn-argentina', { headers: { Cookie: oldCookie }, maxRedirects: 0 }); expect(revoked.status()).toBe(307);
  await login(page);
  const pool = testPool();
  try { await pool.query('UPDATE "session" SET "expiresAt"=NOW() - interval \'1 second\''); } finally { await pool.end(); }
  await page.goto('/gastos'); await expect(page).toHaveURL('/login');
  await login(page);
  const disabledPool = testPool();
  try { await disabledPool.query('UPDATE "user" SET active=false'); } finally { await disabledPool.end(); }
  await page.goto('/'); await expect(page).toHaveURL('/login');
});

test('session storage outage closes financial access without exposing internal diagnostics', async ({ page }) => {
  await login(page);
  const pool = testPool();
  try {
    await pool.query('ALTER TABLE "session" RENAME TO session_outage');
    await page.goto('/empresas/rfn-argentina');
    await expect(page).toHaveURL('/login');
    expect(await page.content()).not.toContain('USD 59,70');
    await page.getByLabel('Email', { exact: true }).fill(ownerEmail);
    await page.getByLabel('Contraseña', { exact: true }).fill(ownerPassword);
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
    await expect(page.locator('form').getByRole('alert')).toContainText('Acceso no disponible');
    expect(await page.content()).not.toContain('session_outage');
  } finally { await pool.query('ALTER TABLE session_outage RENAME TO "session"'); await pool.end(); }
});

test('executive presets update dates, retain manual ranges and preserve monthly navigation', async ({ page }) => {
  await login(page);
  const presets = page.getByRole('navigation', { name: 'Filtros rápidos' });
  await expect(presets.getByRole('link', { name: 'Este mes', exact: true })).toHaveAttribute('aria-current', 'true');
  for (const name of ['Este mes', 'Mes anterior', 'Últimos 3 meses', 'Últimos 6 meses']) {
    const link = presets.getByRole('link', { name, exact: true });
    const target = new URL((await link.getAttribute('href'))!, 'http://127.0.0.1:4317');
    await link.click();
    await expect(page).toHaveURL(target.toString());
    await expect(link).toHaveAttribute('aria-current', 'true');
    await expect(page.getByLabel('Desde', { exact: true })).toHaveValue(target.searchParams.get('desde')!);
    await expect(page.getByLabel('Hasta', { exact: true })).toHaveValue(target.searchParams.get('hasta')!);
  }
  await expect(page.getByRole('heading', { name: 'Comparación con el período anterior', exact: true })).toBeVisible();
  await expect(page.getByText('Comparación consolidada incompleta', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Participación de las empresas', exact: true })).toContainText('Participación no disponible');
  await expect(page.getByRole('region', { name: 'Comparación mensual', exact: true }).getByLabel('Métrica')).toBeVisible();
  await page.getByLabel('Desde', { exact: true }).fill('2024-02-29');
  await page.getByLabel('Hasta', { exact: true }).fill('2024-03-02');
  await page.getByRole('button', { name: 'Consultar', exact: true }).click();
  await expect(page).toHaveURL(/desde=2024-02-29&hasta=2024-03-02/);
  await expect(page.getByText(/Rango personalizado/)).toBeVisible();
  await expect(presets.locator('[aria-current]')).toHaveCount(0);
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  }
  await page.goto('/?desde=2026-02-30&hasta=2026-03-01');
  await expect(page.getByRole('alert')).toContainText('Período o filtros inválidos');
});

test('dashboard preserves financial order through presets and shows streamed loading feedback', async ({ page }) => {
  await login(page);
  const response = await page.request.get('/?desde=2026-11-01&hasta=2026-11-06');
  const html = await response.text();
  expect(html).toContain('Cargando información financiera');
  expect(html).toContain('aria-busy="true"');
  await page.evaluate(() => { (window as Window & { layoutMarker?: string }).layoutMarker = 'preserved'; });
  for (const name of ['Mes anterior', 'Este mes']) {
    await page.getByRole('navigation', { name: 'Filtros rápidos' }).getByRole('link', { name, exact: true }).click();
    await expect(page.getByRole('region', { name: 'Comparación mensual', exact: true }).getByLabel('Métrica')).toBeVisible();
    const positions = await page.evaluate(() => {
      const labels = ['Resumen consolidado', 'Comparación mensual', 'Comparación con el período anterior', 'Participación de las empresas'];
      const nodes = labels.map(label => document.querySelector(`section[aria-label="${label}"]`)!);
      nodes.push([...document.querySelectorAll('section')].find(node => node.querySelector('h2')?.textContent === 'Resumen por empresa')!);
      nodes.push(document.querySelector('nav[aria-label="Secciones financieras"]')!);
      return nodes.map(node => node.getBoundingClientRect().top + window.scrollY);
    });
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  }
  await page.getByLabel('Desde', { exact: true }).fill('2026-10-01');
  await page.getByLabel('Hasta', { exact: true }).fill('2026-10-31');
  await page.getByRole('button', { name: 'Consultar', exact: true }).click();
  await expect(page).toHaveURL(/desde=2026-10-01&hasta=2026-10-31/);
  expect(await page.evaluate(() => (window as Window & { layoutMarker?: string }).layoutMarker)).toBe('preserved');
  for (const name of ['Ingresos', 'Gastos']) {
    await page.getByRole('navigation', { name: 'Secciones financieras' }).getByRole('link', { name, exact: true }).click();
    await expect(page.getByRole('heading', { name: name === 'Gastos' ? 'Gastos y egresos' : name, exact: true })).toBeVisible();
    await page.goto('/');
  }
});
