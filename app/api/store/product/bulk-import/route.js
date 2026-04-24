export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import connectDB from '@/lib/mongodb';
import Product from '@/models/Product';
import Category from '@/models/Category';
import authSeller from '@/middlewares/authSeller';
import { getAuth } from '@/lib/firebase-admin';

const slugify = (value = '') =>
  value
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

const parseNumber = (value, fallback = 0) => {
  if (value === null || value === undefined || value === '') return fallback;
  const normalized = String(value).replace(/,/g, '').trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseStringArray = (value) => {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const extractCategoryNames = (rawCategories = '') => {
  const entries = parseStringArray(rawCategories);
  const names = entries
    .map((entry) => {
      const parts = entry.split('>').map((part) => part.trim()).filter(Boolean);
      return parts.length ? parts[parts.length - 1] : entry.trim();
    })
    .filter(Boolean);

  return [...new Set(names)];
};

const findOrCreateCategoryIds = async (categoryNames = []) => {
  const categoryIds = [];

  for (const categoryName of categoryNames) {
    const slug = slugify(categoryName);
    if (!slug) continue;

    let category = await Category.findOne({ slug }).lean();

    if (!category) {
      try {
        const created = await Category.create({
          name: categoryName,
          slug,
          description: null,
          image: null,
          parentId: null,
        });
        category = created.toObject();
      } catch {
        category = await Category.findOne({ slug }).lean();
      }
    }

    if (category?._id) {
      categoryIds.push(category._id.toString());
    }
  }

  return [...new Set(categoryIds)];
};

const ensureUniqueSlug = async (baseSlug) => {
  const safeBase = slugify(baseSlug) || `product-${Date.now()}`;
  let candidate = safeBase;
  let counter = 1;

  while (await Product.findOne({ slug: candidate }).lean()) {
    counter += 1;
    candidate = `${safeBase}-${counter}`;
  }

  return candidate;
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
    const skipExisting = String(formData.get('skipExisting') || 'true').toLowerCase() === 'true';

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];

    if (!sheetName) {
      return NextResponse.json({ error: 'No worksheet found in file' }, { status: 400 });
    }

    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

    if (!rows.length) {
      return NextResponse.json({ error: 'No rows found in file' }, { status: 400 });
    }

    let created = 0;
    let skipped = 0;
    let failed = 0;
    const failures = [];

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index] || {};
      const rowNumber = index + 2;

      try {
        const name = String(row.Name || row.name || '').trim();
        if (!name) {
          skipped += 1;
          continue;
        }

        const baseSlug = slugify(row.Slug || row.slug || name);
        if (!baseSlug) {
          failed += 1;
          failures.push({ row: rowNumber, reason: 'Unable to generate slug' });
          continue;
        }

        const existingBySlug = await Product.findOne({ slug: baseSlug, storeId }).lean();
        if (existingBySlug && skipExisting) {
          skipped += 1;
          continue;
        }

        const slug = existingBySlug ? await ensureUniqueSlug(baseSlug) : baseSlug;

        // Support both plain text and HTML-formatted descriptions
        // HTML is preserved as-is for rendering with rich text editor
        const description = String(row.Description || row.description || '').trim();
        const shortDescription = String(row['Short description'] || row.shortDescription || '').trim();
        const price = parseNumber(row['Sale price'] || row.price || row['Price'] || row['Sale Price'], 0);
        const mrpFromSheet = parseNumber(row['Regular price'] || row.mrp || row.MRP || row['Regular Price'], price);
        const mrp = mrpFromSheet || price;
        const images = parseStringArray(row.Images || row.images || row.Image || row.image);
        const stockQuantity = parseNumber(row['Meta: _total_stock_quantity'] || row.stockQuantity || row.Stock || row.stock, 0);
        const sku = String(row.SKU || row.sku || row.ID || '').trim() || null;
        const brand = String(row.Brands || row.brand || row.Brand || '').trim();

        const categoryNames = extractCategoryNames(row.Categories || row.categories || '');
        const categoryIds = await findOrCreateCategoryIds(categoryNames);

        if (!categoryIds.length) {
          failed += 1;
          failures.push({ row: rowNumber, reason: 'No valid categories found' });
          continue;
        }

        await Product.create({
          name,
          slug,
          description,
          shortDescription,
          price,
          mrp,
          category: categoryIds[0],
          categories: categoryIds,
          sku,
          images,
          stockQuantity,
          inStock: stockQuantity > 0,
          hasVariants: false,
          variants: [],
          attributes: {
            brand,
          },
          storeId,
        });

        created += 1;
      } catch (rowError) {
        failed += 1;
        failures.push({
          row: rowNumber,
          reason: rowError?.message || 'Failed to import row',
        });
      }
    }

    return NextResponse.json(
      {
        message: 'Bulk import completed',
        summary: {
          totalRows: rows.length,
          created,
          skipped,
          failed,
        },
        failures: failures.slice(0, 100),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Bulk import error:', error);
    return NextResponse.json({ error: error?.message || 'Bulk import failed' }, { status: 500 });
  }
}
