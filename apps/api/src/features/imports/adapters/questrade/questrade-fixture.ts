import * as XLSX from 'xlsx';

export function createQuestradeFixtureBuffer(): Buffer {
  const headers = [
    'Transaction Date', 'Settlement Date', 'Action', 'Symbol', 'Description',
    'Quantity', 'Price', 'Gross Amount', 'Commission', 'Net Amount',
    'Currency', 'Account #', 'Activity Type', 'Account Type',
  ];

  const rows = [
    ['2026-01-28 12:00:00 AM', '2026-01-28 12:00:00 AM', 'DIV', '.BNS',
     'BANK OF NOVA SCOTIA CASH DIV ON 14 SHS REC 01/06/26 PAY 01/28/26',
     0, 0, 0, 0, 15.40, 'CAD', 53481057, 'Dividends', 'Individual TFSA'],
    ['2026-01-15 12:00:00 AM', '2026-01-15 12:00:00 AM', 'DIV', '.BCE',
     'BCE INC COM NEW CASH DIV ON 16 SHS REC 12/15/25 PAY 01/15/26',
     0, 0, 0, 0, 7.00, 'CAD', 53481057, 'Dividends', 'Individual TFSA'],
    ['2026-03-09 12:00:00 AM', '2026-03-09 12:00:00 AM', 'TF6', '',
     '146.16 TRANSFER Desjardins',
     0, 0, 0, 0, 1165.65, 'CAD', 53553685, 'Transfers', 'Individual RRSP'],
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}