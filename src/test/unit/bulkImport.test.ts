/**
 * One-time: call edge function to bulk import all v5 products
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Bulk import via edge function', () => {
  it('imports all products', async () => {
    const jsonPath = path.resolve(__dirname, '../../assets/v5_products.json');
    const products = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    
    const url = `${process.env.VITE_SUPABASE_URL}/functions/v1/bulk-import-products`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({
        company_id: '9215d6c9-585d-4e87-a5b0-30209ef62c9a',
        products,
      }),
    });
    
    const result = await response.json();
    console.log('Import result:', result);
    
    expect(result.success).toBe(true);
    expect(result.total).toBeGreaterThan(600);
  }, 60000);
});
