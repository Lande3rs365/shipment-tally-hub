import * as XLSX from "xlsx";

export interface ParsedSkuProduct {
  sku: string;
  name: string;
  category: string;
  row_type: 'parent' | 'variant' | 'standalone';
  description: string | null;
}

// Category derivation from SKU prefix
function deriveCategory(sku: string): string {
  const s = sku.toUpperCase();
  if (s.startsWith('PC-')) return 'playing_cue';
  if (s.startsWith('SH-')) return 'shaft';
  if (s.startsWith('BK-')) return 'break_cue';
  if (s.startsWith('JP-')) return 'jump_cue';
  if (s.startsWith('BJ-')) return 'break_jump';
  if (s.startsWith('CS-')) return 'case';
  if (s.startsWith('ACC-')) return 'accessory';
  if (s.startsWith('APP-')) return 'apparel';
  return 'other';
}

// Normalize cell value to trimmed string
function cell(row: Record<string, any>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && String(v).trim()) return String(v).trim();
  }
  return '';
}

/**
 * Read a sheet as JSON, auto-detecting the header row by scanning for a target column name.
 * This handles sheets that have title/banner rows before the actual column headers.
 */
function sheetToJsonAutoHeader(sheet: XLSX.WorkSheet, targetHeader: string): Record<string, any>[] {
  // Get all rows as arrays first
  const allRows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });
  
  // Find the row index containing our target header
  let headerIdx = -1;
  for (let i = 0; i < Math.min(allRows.length, 10); i++) {
    const row = allRows[i];
    if (Array.isArray(row) && row.some(c => String(c).trim() === targetHeader)) {
      headerIdx = i;
      break;
    }
  }
  
  if (headerIdx === -1) {
    // Fallback: try default behavior
    return XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
  }
  
  // Use the detected header row as column names
  const headers = allRows[headerIdx].map((h: any) => String(h).trim());
  const result: Record<string, any>[] = [];
  
  for (let i = headerIdx + 1; i < allRows.length; i++) {
    const row = allRows[i];
    if (!Array.isArray(row)) continue;
    const obj: Record<string, any> = {};
    for (let j = 0; j < headers.length; j++) {
      if (headers[j]) {
        obj[headers[j]] = j < row.length ? row[j] : '';
      }
    }
    result.push(obj);
  }
  
  return result;
}

// Parse Sheet 2: Shafts
function parseShafts(sheet: XLSX.WorkSheet): ParsedSkuProduct[] {
  const rows = sheetToJsonAutoHeader(sheet, 'New SKU');
  const products: ParsedSkuProduct[] = [];
  for (const row of rows) {
    const sku = cell(row, 'New SKU', 'new_sku', 'SKU');
    if (!sku || !sku.startsWith('SH-')) continue;
    const model = cell(row, 'Shaft Model', 'shaft_model', 'Model');
    const joint = cell(row, 'Joint Type', 'joint_type');
    const tip = cell(row, 'Tip Size', 'tip_size');
    const desc = [joint, tip].filter(Boolean).join(' | ') || null;
    products.push({
      sku,
      name: model || sku,
      category: 'shaft',
      row_type: 'standalone',
      description: desc,
    });
  }
  return products;
}

// Parse Sheet 3: Playing Cues (has Row Type column)
function parsePlayingCues(sheet: XLSX.WorkSheet): ParsedSkuProduct[] {
  const rows = sheetToJsonAutoHeader(sheet, 'New SKU');
  const products: ParsedSkuProduct[] = [];
  for (const row of rows) {
    const sku = cell(row, 'New SKU', 'new_sku', 'SKU');
    if (!sku || !sku.startsWith('PC-')) continue;
    const model = cell(row, 'Model Name', 'model_name', 'Model');
    const tier = cell(row, 'Tier');
    const wrapCode = cell(row, 'Wrap Code', 'wrap_code');
    const wrapDesc = cell(row, 'Wrap Description', 'wrap_description');
    const rowType = cell(row, 'Row Type', 'row_type').toUpperCase();
    
    const rt: 'parent' | 'variant' = rowType === 'PARENT' ? 'parent' : 'variant';
    const descParts = [tier && `Tier: ${tier}`, wrapCode && wrapCode !== '—' && `Wrap: ${wrapCode}`, wrapDesc && wrapDesc !== '—' && wrapDesc].filter(Boolean);
    
    products.push({
      sku,
      name: model || sku,
      category: 'playing_cue',
      row_type: rt,
      description: descParts.length > 0 ? descParts.join(' | ') : null,
    });
  }
  return products;
}

// Parse Sheet 4: Break & Jump
function parseBreakJump(sheet: XLSX.WorkSheet): ParsedSkuProduct[] {
  const rows = sheetToJsonAutoHeader(sheet, 'New SKU');
  const products: ParsedSkuProduct[] = [];
  for (const row of rows) {
    const sku = cell(row, 'New SKU', 'new_sku', 'SKU');
    if (!sku || !(sku.startsWith('BK-') || sku.startsWith('JP-') || sku.startsWith('BJ-'))) continue;
    const name = cell(row, 'Product Name', 'product_name', 'Name');
    const cueType = cell(row, 'Cue Type', 'cue_type');
    const wrap = cell(row, 'Wrap / Variant', 'wrap_/_variant', 'Wrap');
    const desc = [cueType, wrap].filter(Boolean).join(' | ') || null;
    products.push({
      sku,
      name: name || sku,
      category: deriveCategory(sku),
      row_type: 'standalone',
      description: desc,
    });
  }
  return products;
}

// Parse Sheet 5: Cases
function parseCases(sheet: XLSX.WorkSheet): ParsedSkuProduct[] {
  const rows = sheetToJsonAutoHeader(sheet, 'New SKU');
  const products: ParsedSkuProduct[] = [];
  for (const row of rows) {
    const sku = cell(row, 'New SKU', 'new_sku', 'SKU');
    if (!sku || !sku.startsWith('CS-')) continue;
    const name = cell(row, 'Product Name', 'product_name', 'Name');
    const type = cell(row, 'Type');
    const colour = cell(row, 'Colour');
    const size = cell(row, 'Size/Capacity', 'size_capacity', 'Size');
    const descParts = [type, colour && colour !== '—' && colour, size && size !== '—' && size].filter(Boolean);
    products.push({
      sku,
      name: name || sku,
      category: 'case',
      row_type: 'standalone',
      description: descParts.length > 0 ? descParts.join(' | ') : null,
    });
  }
  return products;
}

// Parse Sheet 6: Accessories
function parseAccessories(sheet: XLSX.WorkSheet): ParsedSkuProduct[] {
  const rows = sheetToJsonAutoHeader(sheet, 'New SKU');
  const products: ParsedSkuProduct[] = [];
  for (const row of rows) {
    const sku = cell(row, 'New SKU', 'new_sku', 'SKU');
    if (!sku || !sku.startsWith('ACC-')) continue;
    const name = cell(row, 'Product Name', 'product_name', 'Name');
    const subCat = cell(row, 'Sub-Cat', 'sub_cat', 'SubCat');
    const variant = cell(row, 'Variant / Size', 'variant_/_size', 'Variant');
    const descParts = [subCat, variant].filter(Boolean);
    products.push({
      sku,
      name: name || sku,
      category: 'accessory',
      row_type: 'standalone',
      description: descParts.length > 0 ? descParts.join(' | ') : null,
    });
  }
  return products;
}

// Parse Sheet 7: Apparel (has Size column = PARENT for parents)
function parseApparel(sheet: XLSX.WorkSheet): ParsedSkuProduct[] {
  const rows = sheetToJsonAutoHeader(sheet, 'New SKU');
  const products: ParsedSkuProduct[] = [];
  for (const row of rows) {
    const sku = cell(row, 'New SKU', 'new_sku', 'SKU');
    if (!sku || !sku.startsWith('APP-')) continue;
    const name = cell(row, 'Design Name', 'design_name', 'Name');
    const cat = cell(row, 'Category');
    const gender = cell(row, 'Gender');
    const type = cell(row, 'Type');
    const colour = cell(row, 'Colour');
    const size = cell(row, 'Size');
    
    const isParent = size.toUpperCase() === 'PARENT';
    const descParts = [cat, gender && `Gender: ${gender}`, type, colour && colour !== '—' && colour, !isParent && size && size !== '—' && `Size: ${size}`].filter(Boolean);
    
    products.push({
      sku,
      name: name || sku,
      category: 'apparel',
      row_type: isParent ? 'parent' : 'variant',
      description: descParts.length > 0 ? descParts.join(' | ') : null,
    });
  }
  return products;
}

export function parseSkuFrameworkXlsx(data: ArrayBuffer): ParsedSkuProduct[] {
  const workbook = XLSX.read(data, { type: 'array', cellDates: true });
  const sheets = workbook.SheetNames;
  
  const all: ParsedSkuProduct[] = [];
  
  // Sheet indices: 0=Overview, 1=Shafts, 2=Playing Cues, 3=Break&Jump, 4=Cases, 5=Accessories, 6=Apparel
  const parsers = [
    { index: 1, fn: parseShafts },
    { index: 2, fn: parsePlayingCues },
    { index: 3, fn: parseBreakJump },
    { index: 4, fn: parseCases },
    { index: 5, fn: parseAccessories },
    { index: 6, fn: parseApparel },
  ];
  
  for (const { index, fn } of parsers) {
    if (index < sheets.length) {
      const sheet = workbook.Sheets[sheets[index]];
      if (sheet) all.push(...fn(sheet));
    }
  }
  
  return all;
}

// Resolve parent_product_id for variants by finding the parent SKU
// For playing cues: variant PC-ASP-JF1010-NW -> parent PC-ASP-JF1010
// For apparel: variant APP-MJ-PATRIOT-USA-S -> parent APP-MJ-PATRIOT-USA
export function resolveParentSku(variantSku: string, category: string): string | null {
  if (category === 'playing_cue' || category === 'apparel') {
    const segments = variantSku.split('-');
    // Remove last segment to get parent SKU
    if (segments.length >= 4) {
      return segments.slice(0, -1).join('-');
    }
  }
  return null;
}
