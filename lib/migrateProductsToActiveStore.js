import Product from '@/models/Product';
import Store from '@/models/Store';

export const migrateProductsToActiveStore = async ({ userId, activeStoreId }) => {
  if (!userId || !activeStoreId) {
    return { migratedCount: 0, legacyStoreIds: [] };
  }

  const activeId = String(activeStoreId);
  const ownedStores = await Store.find({ userId }).select('_id').lean();
  const legacyStoreIds = ownedStores
    .map((store) => String(store._id))
    .filter((storeId) => storeId !== activeId);

  if (!legacyStoreIds.length) {
    return { migratedCount: 0, legacyStoreIds: [] };
  }

  const result = await Product.updateMany(
    { storeId: { $in: legacyStoreIds } },
    { $set: { storeId: activeId } }
  );

  return {
    migratedCount: Number(result?.modifiedCount || 0),
    legacyStoreIds,
  };
};
