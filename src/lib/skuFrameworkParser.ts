import * as XLSX from "xlsx";

// ── xlsx security mitigations (GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9) ──
const XLSX_MAX_BYTES = 20 * 1024 * 1024;
const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function sanitizeRow(row: Record<string, any>): Record<string, any> {
  const safe: Record<string, any> = Object.create(null);
  for (const key of Object.keys(row)) {
    if (!DANGEROUS_KEYS.has(key)) safe[key] = row[key];
  }
  return safe;
}

function assertXlsxSize(data: ArrayBuffer): void {
  if (data.byteLength > XLSX_MAX_BYTES) {
    throw new Error(`File too large (${(data.byteLength / 1024 / 1024).toFixed(1)} MB). Maximum allowed size is 20 MB.`);
  }
}

export interface ParsedSkuProduct {
  sku: string;
  name: string;
  category: string;
  row_type: 'parent' | 'variant' | 'standalone';
  description: string | null;
}

// Category derivation from SKU prefix (v12 format)
function deriveCategory(sku: string): string {
  const s = sku.toUpperCase();
  if (s.startsWith('JF-PC-') || s.startsWith('DL-PC-')) return 'playing_cue';
  if (s.startsWith('SH-')) return 'shaft';
  if (s.startsWith('BK-')) return 'break_cue';
  if (s.startsWith('JP-')) return 'jump_cue';
  if (s.startsWith('BJ-')) return 'break_jump';
  if (s.startsWith('CS-')) return 'case';
  if (s.startsWith('ACC-')) return 'accessory';
  if (s.startsWith('APP-')) return 'apparel';
  // Legacy v5 prefixes
  if (s.startsWith('PC-')) return 'playing_cue';
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

// Map Row Type column to our internal types
function mapRowType(raw: string): 'parent' | 'variant' {
  const upper = raw.toUpperCase();
  if (upper === 'MODEL' || upper === 'PARENT') return 'parent';
  return 'variant';
}

/**
 * Read a sheet as JSON, auto-detecting the header row by scanning for a target column name.
 */
function sheetToJsonAutoHeader(sheet: XLSX.WorkSheet, targetHeader: string): Record<string, any>[] {
  const allRows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });

  let headerIdx = -1;
  for (let i = 0; i < Math.min(allRows.length, 10); i++) {
    const row = allRows[i];
    if (Array.isArray(row) && row.some(c => String(c).trim() === targetHeader)) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1) {
    return XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' }).map(sanitizeRow);
  }

  const headers = allRows[headerIdx].map((h: any) => String(h).trim());
  const result: Record<string, any>[] = [];

  for (let i = headerIdx + 1; i < allRows.length; i++) {
    const row = allRows[i];
    if (!Array.isArray(row)) continue;
    const obj: Record<string, any> = Object.create(null);
    for (let j = 0; j < headers.length; j++) {
      if (headers[j] && !DANGEROUS_KEYS.has(headers[j])) {
        obj[headers[j]] = j < row.length ? row[j] : '';
      }
    }
    result.push(obj);
  }

  return result;
}

// Check if a value is a section header row (e.g. "── Classic — Low Deflection Carbon Fiber ($199) ──")
function isSectionRow(sku: string): boolean {
  return sku.startsWith('──') || sku.startsWith('—') || sku === '';
}

// Parse Sheet 2: Shafts (v12: has MODEL/VARIANT Row Type)
function parseShafts(sheet: XLSX.WorkSheet): ParsedSkuProduct[] {
  const rows = sheetToJsonAutoHeader(sheet, 'SKU');
  const products: ParsedSkuProduct[] = [];
  for (const row of rows) {
    const sku = cell(row, 'SKU', 'New SKU', 'new_sku');
    if (!sku || isSectionRow(sku) || !sku.startsWith('SH-')) continue;
    const name = cell(row, 'Shaft Name', 'Shaft Model', 'shaft_model', 'Model');
    const joint = cell(row, 'Joint', 'Joint Type', 'joint_type');
    const tip = cell(row, 'Tip Size', 'tip_size');
    const rowType = cell(row, 'Row Type', 'row_type');
    const rt = rowType ? mapRowType(rowType) : 'standalone';
    const desc = [joint !== '—' && joint, tip !== '—' && tip].filter(Boolean).join(' | ') || null;
    products.push({ sku, name: name || sku, category: 'shaft', row_type: rt, description: desc });
  }
  return products;
}

// Parse Sheet 3: Playing Cues (v12: JF-PC- / DL-PC- prefixes, Channel column)
function parsePlayingCues(sheet: XLSX.WorkSheet): ParsedSkuProduct[] {
  const rows = sheetToJsonAutoHeader(sheet, 'SKU');
  const products: ParsedSkuProduct[] = [];
  for (const row of rows) {
    const sku = cell(row, 'SKU', 'New SKU', 'new_sku');
    if (!sku || isSectionRow(sku)) continue;
    if (!(sku.startsWith('JF-PC-') || sku.startsWith('DL-PC-') || sku.startsWith('PC-'))) continue;
    const name = cell(row, 'Product Name', 'Model Name', 'model_name', 'Model');
    const tier = cell(row, 'Tier');
    const channel = cell(row, 'Channel');
    const wrap = cell(row, 'Wrap / Finish', 'Wrap Code', 'wrap_code');
    const notes = cell(row, 'Notes');
    const rowType = cell(row, 'Row Type', 'row_type');
    const rt = rowType ? mapRowType(rowType) : 'variant';
    const descParts = [
      tier && `Tier: ${tier}`,
      channel && channel !== '—' && `Channel: ${channel}`,
      wrap && wrap !== '—' && `Wrap: ${wrap}`,
      notes && notes !== '—' && notes,
    ].filter(Boolean);
    products.push({
      sku, name: name || sku, category: 'playing_cue', row_type: rt,
      description: descParts.length > 0 ? descParts.join(' | ') : null,
    });
  }
  return products;
}

// Parse Sheet 4: Break & Jump (v12: has MODEL/VARIANT)
function parseBreakJump(sheet: XLSX.WorkSheet): ParsedSkuProduct[] {
  const rows = sheetToJsonAutoHeader(sheet, 'SKU');
  const products: ParsedSkuProduct[] = [];
  for (const row of rows) {
    const sku = cell(row, 'SKU', 'New SKU', 'new_sku');
    if (!sku || isSectionRow(sku)) continue;
    if (!(sku.startsWith('BK-') || sku.startsWith('JP-') || sku.startsWith('BJ-'))) continue;
    const name = cell(row, 'Product Name', 'product_name', 'Name');
    const cueType = cell(row, 'Type', 'Cue Type', 'cue_type');
    const wrap = cell(row, 'Wrap / Variant', 'wrap_/_variant', 'Wrap');
    const rowType = cell(row, 'Row Type', 'row_type');
    const rt = rowType ? mapRowType(rowType) : 'standalone';
    const notes = cell(row, 'Notes');
    const descParts = [
      cueType && cueType !== '—' && cueType,
      wrap && wrap !== '—' && wrap,
      notes && notes !== '—' && notes,
    ].filter(Boolean);
    products.push({
      sku, name: name || sku, category: deriveCategory(sku), row_type: rt,
      description: descParts.length > 0 ? descParts.join(' | ') : null,
    });
  }
  return products;
}

// Parse Sheet 5: Cases (v12: has MODEL/VARIANT, Capacity column)
function parseCases(sheet: XLSX.WorkSheet): ParsedSkuProduct[] {
  const rows = sheetToJsonAutoHeader(sheet, 'SKU');
  const products: ParsedSkuProduct[] = [];
  for (const row of rows) {
    const sku = cell(row, 'SKU', 'New SKU', 'new_sku');
    if (!sku || isSectionRow(sku) || !sku.startsWith('CS-')) continue;
    const name = cell(row, 'Product Name', 'product_name', 'Name');
    const type = cell(row, 'Type');
    const colour = cell(row, 'Colour', 'Color');
    const capacity = cell(row, 'Capacity', 'Size/Capacity', 'size_capacity', 'Size');
    const rowType = cell(row, 'Row Type', 'row_type');
    const rt = rowType ? mapRowType(rowType) : 'standalone';
    const notes = cell(row, 'Notes');
    const descParts = [
      type && type !== '—' && type,
      colour && colour !== '—' && colour,
      capacity && capacity !== '—' && capacity,
      notes && notes !== '—' && notes,
    ].filter(Boolean);
    products.push({
      sku, name: name || sku, category: 'case', row_type: rt,
      description: descParts.length > 0 ? descParts.join(' | ') : null,
    });
  }
  return products;
}

// Parse Sheet 6: Accessories (v12: has MODEL/VARIANT)
function parseAccessories(sheet: XLSX.WorkSheet): ParsedSkuProduct[] {
  const rows = sheetToJsonAutoHeader(sheet, 'SKU');
  const products: ParsedSkuProduct[] = [];
  for (const row of rows) {
    const sku = cell(row, 'SKU', 'New SKU', 'new_sku');
    if (!sku || isSectionRow(sku) || !sku.startsWith('ACC-')) continue;
    const name = cell(row, 'Product Name', 'product_name', 'Name');
    const subCat = cell(row, 'Sub-Cat', 'sub_cat', 'SubCat');
    const variant = cell(row, 'Variant', 'Variant / Size', 'variant_/_size');
    const rowType = cell(row, 'Row Type', 'row_type');
    const rt = rowType ? mapRowType(rowType) : 'standalone';
    const notes = cell(row, 'Notes');
    const descParts = [
      subCat && subCat !== '—' && subCat,
      variant && variant !== '—' && variant,
      notes && notes !== '—' && notes,
    ].filter(Boolean);
    products.push({
      sku, name: name || sku, category: 'accessory', row_type: rt,
      description: descParts.length > 0 ? descParts.join(' | ') : null,
    });
  }
  return products;
}

// Parse Sheet 7: Apparel (v12: MODEL/VARIANT with Size column)
function parseApparel(sheet: XLSX.WorkSheet): ParsedSkuProduct[] {
  const rows = sheetToJsonAutoHeader(sheet, 'SKU');
  const products: ParsedSkuProduct[] = [];
  for (const row of rows) {
    const sku = cell(row, 'SKU', 'New SKU', 'new_sku');
    if (!sku || isSectionRow(sku) || !sku.startsWith('APP-')) continue;
    const name = cell(row, 'Design Name', 'design_name', 'Name');
    const gender = cell(row, 'Gender');
    const type = cell(row, 'Type', 'Category');
    const size = cell(row, 'Size');
    const rowType = cell(row, 'Row Type', 'row_type');
    const rt = rowType ? mapRowType(rowType) : (size === '—' || !size ? 'parent' : 'variant');
    const notes = cell(row, 'Notes');
    const descParts = [
      gender && gender !== '—' && `Gender: ${gender}`,
      type && type !== '—' && type,
      rt === 'variant' && size && size !== '—' && `Size: ${size}`,
      notes && notes !== '—' && notes,
    ].filter(Boolean);
    products.push({
      sku, name: name || sku, category: 'apparel', row_type: rt,
      description: descParts.length > 0 ? descParts.join(' | ') : null,
    });
  }
  return products;
}

export function parseSkuFrameworkXlsx(data: ArrayBuffer): ParsedSkuProduct[] {
  assertXlsxSize(data);
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

/**
 * Resolve parent SKU for a variant by walking up the segment tree.
 * Tries removing segments from the end until finding a match in the known SKU set.
 * e.g. SH-CL-RAD-118 → tries SH-CL-RAD (miss) → SH-CL (hit!)
 * If no knownSkus provided, falls back to removing the last segment.
 */
export function resolveParentSku(variantSku: string, knownSkus?: Set<string>): string | null {
  const segments = variantSku.split('-');
  if (segments.length < 3) return null;

  if (knownSkus) {
    for (let len = segments.length - 1; len >= 2; len--) {
      const candidate = segments.slice(0, len).join('-');
      if (knownSkus.has(candidate)) return candidate;
    }
    return null;
  }

  return segments.slice(0, -1).join('-');
}
