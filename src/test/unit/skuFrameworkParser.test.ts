import { describe, it, expect } from 'vitest';
import { parseSkuFrameworkXlsx } from '@/lib/skuFrameworkParser';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

describe('SKU Framework Parser v5', () => {
  it('parses the v5 spreadsheet with correct category counts', () => {
    const filePath = path.resolve(__dirname, '../../assets/JFlowers_SKU_Framework_v5.xlsx');
    const buffer = fs.readFileSync(filePath);
    const arrayBuffer = new Uint8Array(buffer).buffer;
    
    // Debug: check what XLSX sees
    const wb = XLSX.read(arrayBuffer, { type: 'array' });
    console.log('Sheet names:', wb.SheetNames);
    console.log('Sheet count:', wb.SheetNames.length);
    
    // Check sheet 1 (index 1 = Shafts)
    if (wb.SheetNames.length > 1) {
      const s = wb.Sheets[wb.SheetNames[1]];
      const rows = XLSX.utils.sheet_to_json<any[]>(s, { header: 1, defval: '' });
      console.log('Sheet 2 first 5 rows:', rows.slice(0, 5));
    }
    
    const products = parseSkuFrameworkXlsx(arrayBuffer);
    
    const byCat: Record<string, number> = {};
    for (const p of products) {
      byCat[p.category] = (byCat[p.category] || 0) + 1;
    }
    
    console.log('Category counts:', byCat);
    console.log('Total products:', products.length);
    
    expect(byCat['shaft']).toBe(30);
    expect(byCat['case']).toBeGreaterThanOrEqual(40);
  });
});
