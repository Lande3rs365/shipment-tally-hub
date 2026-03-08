import { describe, it, expect } from 'vitest';
import { parseSkuFrameworkXlsx } from '@/lib/skuFrameworkParser';
import * as fs from 'fs';
import * as path from 'path';

describe('SKU Framework Parser v5', () => {
  it('parses the v5 spreadsheet with correct category counts', () => {
    const filePath = path.resolve(__dirname, '../../assets/JFlowers_SKU_Framework_v5.xlsx');
    const buffer = fs.readFileSync(filePath);
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    
    const products = parseSkuFrameworkXlsx(arrayBuffer);
    
    // Group by category
    const byCat: Record<string, number> = {};
    for (const p of products) {
      byCat[p.category] = (byCat[p.category] || 0) + 1;
    }
    
    console.log('Category counts:', byCat);
    console.log('Total products:', products.length);
    
    // Expected from v5 spreadsheet
    expect(byCat['shaft']).toBe(30);
    expect(byCat['playing_cue']).toBeGreaterThanOrEqual(170);
    expect(byCat['break_cue']).toBeGreaterThanOrEqual(8);
    expect(byCat['jump_cue']).toBeGreaterThanOrEqual(7);
    expect(byCat['break_jump']).toBe(2);
    expect(byCat['case']).toBeGreaterThanOrEqual(40);
    expect(byCat['accessory']).toBeGreaterThanOrEqual(50);
    expect(byCat['apparel']).toBeGreaterThanOrEqual(200);
  });
});
