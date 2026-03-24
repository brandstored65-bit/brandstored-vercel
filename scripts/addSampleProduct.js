// This script will add a sample product to your database using Prisma Client.
// Run with: node scripts/addSampleProduct.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const product = await prisma.product.create({
    data: {
      name: 'Sample Product',
      slug: 'sample-product',
      description: 'A sample product for testing grid section.',
      AED: 1000,
      price: 799,
      images: ['https://ik.imagekit.io/jrstupuke/placeholder.png'],
      category: 'Sample',
      inStock: true,
      hasVariants: false,
      variants: [],
      attributes: {},
      hasBulkPricing: false,
      bulkPricing: [],
      fastDelivery: false,
      allowReturn: true,
      allowReplacement: true,
      storeId: 'sample-store', // Replace with a valid storeId if needed
    },
  });
  console.log('Sample product created:', product);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
