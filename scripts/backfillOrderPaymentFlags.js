import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const FAIL_OR_UNPAID_STATUSES = [
  'FAILED',
  'PAYMENT_FAILED',
  'REFUNDED',
  'UNPAID',
  'PENDING',
  'EXPIRED',
  'CANCELED',
  'CANCELLED',
  '',
  null,
];

const FAIL_OR_CANCELLED_ORDER_STATUSES = [
  'PAYMENT_FAILED',
  'CANCELLED',
  'CANCELED',
  'REFUNDED',
  'EXPIRED',
];

const hasFlag = (argv, flag) => argv.includes(flag);

function buildDefiniteWrongPaidFilter() {
  return {
    isPaid: true,
    paymentMethod: { $exists: true, $nin: [null, '', 'COD', 'cod'] },
    $or: [
      { paymentStatus: { $in: FAIL_OR_UNPAID_STATUSES } },
      { status: { $in: FAIL_OR_CANCELLED_ORDER_STATUSES } },
      { status: { $exists: false } },
      { paymentStatus: { $exists: false } },
    ],
  };
}

function buildSuspiciousButNotAutoFixFilter() {
  return {
    isPaid: true,
    paymentMethod: { $in: ['STRIPE', 'stripe', 'CARD', 'card'] },
    paymentStatus: { $in: ['PAID', 'paid', 'CAPTURED', 'captured', 'SUCCEEDED', 'succeeded', 'SUCCESS', 'success'] },
    razorpayPaymentId: { $in: [null, ''] },
  };
}

async function run() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is missing in .env');
  }

  const argv = process.argv.slice(2);
  const apply = hasFlag(argv, '--apply');
  const alsoFixSuspicious = hasFlag(argv, '--also-fix-suspicious');
  const limitArg = argv.find((x) => x.startsWith('--limit='));
  const limit = Number(limitArg?.split('=')[1] || 0);

  if (Number.isNaN(limit) || limit < 0) {
    throw new Error('Invalid --limit value. Example: --limit=200');
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const orders = mongoose.connection.db.collection('orders');

  const definiteFilter = buildDefiniteWrongPaidFilter();
  const suspiciousFilter = buildSuspiciousButNotAutoFixFilter();

  const definiteCount = await orders.countDocuments(definiteFilter);
  const suspiciousCount = await orders.countDocuments(suspiciousFilter);

  console.log('\n=== Backfill Order Payment Flags ===');
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY RUN'}`);
  console.log(`Definite wrong paid orders: ${definiteCount}`);
  console.log(`Suspicious paid orders (not auto-fixed by default): ${suspiciousCount}`);

  const previewLimit = limit > 0 ? limit : 20;

  const definitePreview = await orders
    .find(definiteFilter)
    .project({ _id: 1, shortOrderNumber: 1, paymentMethod: 1, paymentStatus: 1, status: 1, isPaid: 1, updatedAt: 1 })
    .sort({ updatedAt: -1 })
    .limit(previewLimit)
    .toArray();

  if (definitePreview.length > 0) {
    console.log(`\nPreview definite wrong paid orders (up to ${previewLimit}):`);
    definitePreview.forEach((o, idx) => {
      console.log(
        `${idx + 1}. id=${o._id} short=${o.shortOrderNumber || '-'} method=${o.paymentMethod || '-'} paymentStatus=${o.paymentStatus || '-'} status=${o.status || '-'} isPaid=${o.isPaid}`
      );
    });
  }

  if (!apply) {
    console.log('\nNo changes made (dry run). Re-run with --apply to update orders.');
  } else {
    const updateResult = await orders.updateMany(
      definiteFilter,
      {
        $set: {
          isPaid: false,
          updatedAt: new Date(),
        },
      }
    );

    console.log(`\nUpdated definite wrong paid orders: ${updateResult.modifiedCount}`);

    if (alsoFixSuspicious) {
      const suspiciousUpdate = await orders.updateMany(
        suspiciousFilter,
        {
          $set: {
            isPaid: false,
            paymentStatus: 'PENDING',
            updatedAt: new Date(),
          },
        }
      );
      console.log(`Updated suspicious orders (--also-fix-suspicious): ${suspiciousUpdate.modifiedCount}`);
    }
  }

  const suspiciousPreview = await orders
    .find(suspiciousFilter)
    .project({ _id: 1, shortOrderNumber: 1, paymentMethod: 1, paymentStatus: 1, status: 1, isPaid: 1, updatedAt: 1 })
    .sort({ updatedAt: -1 })
    .limit(previewLimit)
    .toArray();

  if (suspiciousPreview.length > 0) {
    console.log(`\nSuspicious paid orders sample (up to ${previewLimit}):`);
    suspiciousPreview.forEach((o, idx) => {
      console.log(
        `${idx + 1}. id=${o._id} short=${o.shortOrderNumber || '-'} method=${o.paymentMethod || '-'} paymentStatus=${o.paymentStatus || '-'} status=${o.status || '-'} isPaid=${o.isPaid}`
      );
    });
    console.log('\nTip: use --also-fix-suspicious only after reviewing these records.');
  }

  await mongoose.connection.close();
  process.exit(0);
}

run().catch(async (error) => {
  console.error('\nBackfill failed:', error?.message || error);
  try {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
  } catch (closeError) {
    console.error('Failed to close MongoDB connection:', closeError?.message || closeError);
  }
  process.exit(1);
});
