import { describe, it, expect } from 'vitest';
import { parseSkuFrameworkXlsx } from '@/lib/skuFrameworkParser';
import * as fs from 'fs';
import * as path from 'path';

describe('SKU Framework Parser v12', () => {
  it('parses the v12 spreadsheet and produces products across all categories', () => {
    const filePath = path.resolve(__dirname, '../../assets/JFlowers_SKU_Framework_v12.xlsx');
    const buffer = fs.readFileSync(filePath);
    const arrayBuffer = new Uint8Array(buffer).buffer;
    
    const products = parseSkuFrameworkXlsx(arrayBuffer);
    
    const byCat: Record<string, number> = {};
    const byType: Record<string, number> = {};
    for (const p of products) {
      byCat[p.category] = (byCat[p.category] || 0) + 1;
      byType[p.row_type] = (byType[p.row_type] || 0) + 1;
    }
    
    console.log('Category counts:', byCat);
    console.log('Row type counts:', byType);
    console.log('Total products:', products.length);
    
    // v12 should have products in all categories
    expect(byCat['shaft']).toBeGreaterThan(0);
    expect(byCat['playing_cue']).toBeGreaterThan(0);
    expect(byCat['case']).toBeGreaterThan(0);
    expect(byCat['accessory']).toBeGreaterThan(0);
    expect(byCat['apparel']).toBeGreaterThan(0);
    
    // Should have both parents and variants
    expect(byType['parent']).toBeGreaterThan(0);
    expect(byType['variant']).toBeGreaterThan(0);
    
    // Total should be substantial
    expect(products.length).toBeGreaterThan(200);
  });

  it('correctly identifies MODEL rows as parent type', () => {
    const filePath = path.resolve(__dirname, '../../assets/JFlowers_SKU_Framework_v12.xlsx');
    const buffer = fs.readFileSync(filePath);
    const arrayBuffer = new Uint8Array(buffer).buffer;
    
    const products = parseSkuFrameworkXlsx(arrayBuffer);
    
    // SH-CL should be a parent (MODEL row)
    const shCl = products.find(p => p.sku === 'SH-CL');
    expect(shCl).toBeDefined();
    expect(shCl?.row_type).toBe('parent');
    
    // SH-CL-RAD-125 should be a variant
    const shClVar = products.find(p => p.sku === 'SH-CL-RAD-125');
    expect(shClVar).toBeDefined();
    expect(shClVar?.row_type).toBe('variant');
  });

  it('handles JF- and DL- playing cue prefixes', () => {
    const filePath = path.resolve(__dirname, '../../assets/JFlowers_SKU_Framework_v12.xlsx');
    const buffer = fs.readFileSync(filePath);
    const arrayBuffer = new Uint8Array(buffer).buffer;
    
    const products = parseSkuFrameworkXlsx(arrayBuffer);
    
    const jfCues = products.filter(p => p.sku.startsWith('JF-PC-'));
    const dlCues = products.filter(p => p.sku.startsWith('DL-PC-'));
    
    expect(jfCues.length).toBeGreaterThan(0);
    expect(dlCues.length).toBeGreaterThan(0);
    
    // All should be categorized as playing_cue
    for (const p of [...jfCues, ...dlCues]) {
      expect(p.category).toBe('playing_cue');
    }
  });
});
