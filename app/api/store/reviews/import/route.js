export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import connectDB from '@/lib/mongodb';
import Product from '@/models/Product';
import Rating from '@/models/Rating';
import authSeller from '@/middlewares/authSeller';
import { getAuth } from '@/lib/firebase-admin';

const normalizeHeader = (value = '') =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ');

const getRowValue = (row, aliases = []) => {
  const normalizedEntries = Object.entries(row || {}).map(([key, value]) => [normalizeHeader(key), value]);
  const normalizedRow = Object.fromEntries(normalizedEntries);

  for (const alias of aliases) {
    const matchedValue = normalizedRow[normalizeHeader(alias)];
    if (matchedValue !== undefined && matchedValue !== null && String(matchedValue).trim() !== '') {
      return matchedValue;
    }
  }

  return '';
};

const parseRating = (value) => {
  const parsed = Number(String(value ?? '').trim());
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.round(parsed);
  if (rounded < 1 || rounded > 5) return null;
  return rounded;
};

const parseImportedDate = (value) => {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  const match = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (!match) return null;

  const first = Number(match[1]);
  const second = Number(match[2]);
  const year = Number(match[3]);
  const dayFirstDate = new Date(year, second - 1, first);

  if (!Number.isNaN(dayFirstDate.getTime())) {
    return dayFirstDate;
  }

  return null;
};

const buildProductIndexes = (products = []) => {
  const skuMap = new Map();
  const nameMap = new Map();

  for (const product of products) {
    const normalizedSku = String(product?.sku || '').trim().toLowerCase();
    const normalizedName = String(product?.name || '').trim().toLowerCase();

    if (normalizedSku) {
      skuMap.set(normalizedSku, product);
    }

    if (normalizedName) {
      const existingProducts = nameMap.get(normalizedName) || [];
      existingProducts.push(product);
      nameMap.set(normalizedName, existingProducts);
    }
  }

  return { skuMap, nameMap };
};

export async function POST(request) {
  try {
    await connectDB();

    const authHeader = request.headers.get('authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const userId = decodedToken.uid;
    const storeId = await authSeller(userId);

    if (!storeId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
    const sheetName = workbook.SheetNames[0];

    if (!sheetName) {
      return NextResponse.json({ error: 'No worksheet found in file' }, { status: 400 });
    }

    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      defval: '',
      raw: false,
    });

    if (!rows.length) {
      return NextResponse.json({ error: 'No rows found in file' }, { status: 400 });
    }

    const products = await Product.find({ storeId }).select('_id name sku').lean();
    const { skuMap, nameMap } = buildProductIndexes(products);

    let imported = 0;
    let skipped = 0;
    let failed = 0;
    const failures = [];

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index] || {};
      const rowNumber = index + 2;

      try {
        const customerName = String(getRowValue(row, ['customer name', 'name'])).trim();
        const customerEmail = String(getRowValue(row, ['customer email', 'email'])).trim();
        const productSku = String(getRowValue(row, ['product sku', 'product sku (identifier)', 'sku'])).trim();
        const productName = String(getRowValue(row, ['product name', 'product name (identifier)', 'name of product', 'product'])).trim();
        const ratingValue = getRowValue(row, ['review rating', 'rating', 'review']);
        const reviewText = String(getRowValue(row, ['review description', 'review text', 'review comment', 'description', 'review'])).trim();
        const dateValue = getRowValue(row, ['date', 'review date', 'created at']);

        if (!customerName && !customerEmail && !productSku && !productName && !ratingValue && !reviewText && !dateValue) {
          skipped += 1;
          continue;
        }

        if (!customerName || !customerEmail || !reviewText) {
          failed += 1;
          failures.push({ row: rowNumber, reason: 'Customer name, customer email, and review description are required' });
          continue;
        }

        const parsedRating = parseRating(ratingValue);
        if (!parsedRating) {
          failed += 1;
          failures.push({ row: rowNumber, reason: 'Review rating must be between 1 and 5' });
          continue;
        }

        let matchedProduct = null;

        if (productSku) {
          matchedProduct = skuMap.get(productSku.toLowerCase()) || null;
        }

        if (!matchedProduct && productName) {
          const productMatches = nameMap.get(productName.toLowerCase()) || [];
          if (productMatches.length > 1) {
            failed += 1;
            failures.push({ row: rowNumber, reason: `Multiple store products match name "${productName}". Use Product SKU instead.` });
            continue;
          }
          matchedProduct = productMatches[0] || null;
        }

        if (!productSku && !productName) {
          failed += 1;
          failures.push({ row: rowNumber, reason: 'Provide either Product SKU or Product Name' });
          continue;
        }

        if (!matchedProduct) {
          failed += 1;
          failures.push({ row: rowNumber, reason: 'No store product matched the provided SKU or product name' });
          continue;
        }

        const importedDate = parseImportedDate(dateValue);
        const timestamp = importedDate || new Date();

        await Rating.create({
          userId: `manual_import_${Date.now()}_${index}`,
          productId: matchedProduct._id.toString(),
          rating: parsedRating,
          review: reviewText,
          comment: reviewText,
          customerName,
          customerEmail,
          approved: true,
          isApproved: true,
          createdAt: timestamp,
          updatedAt: timestamp,
        });

        imported += 1;
      } catch (rowError) {
        failed += 1;
        failures.push({
          row: rowNumber,
          reason: rowError?.message || 'Failed to import row',
        });
      }
    }

    return NextResponse.json({
      message: 'Review import completed',
      summary: {
        totalRows: rows.length,
        imported,
        skipped,
        failed,
      },
      failures: failures.slice(0, 100),
    });
  } catch (error) {
    console.error('Review import error:', error);
    return NextResponse.json({ error: error?.message || 'Review import failed' }, { status: 500 });
  }
}
