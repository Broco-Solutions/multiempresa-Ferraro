export const companies = [
  { id: 'ferraro-detail', name: 'Ferraro Detail', initial: 'FD', short: 'Ferraro', color: 'var(--company-ferraro)', logo: { src: '/brand/ferraro-mark-tricolor.svg', width: 19, height: 57 } },
  { id: 'ppf-house', name: 'PPF House', initial: 'PH', short: 'PPF', color: 'var(--company-ppf)', logo: { src: '/brand/ppf-house-mark.png', width: 117, height: 130 } },
  { id: 'rfn-argentina', name: 'RFN Argentina', initial: 'RF', short: 'RFN', color: 'var(--company-rfn)', logo: { src: '/brand/rfn-logo.png', width: 640, height: 156 } },
] as const;
export type CompanyId = (typeof companies)[number]['id'];
export function companyById(id: string) {
  return companies.find(company => company.id === id);
}
