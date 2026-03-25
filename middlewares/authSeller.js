import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import Store from '@/models/Store';
import StoreUser from '@/models/StoreUser';

const authSeller = async (userId) => {
    try {
        if (!userId) {
            console.log('[authSeller] No userId provided');
            return false;
        }
        await connectDB();

        // First check: Team membership (shared dashboard) takes priority.
        // Only approved members should resolve seller access.
        // This ensures invited members open the same store dashboard, not a separate one.
        let teamMembership = await StoreUser.findOne({
            userId: userId,
            status: 'approved'
        }).sort({ updatedAt: -1 }).lean();

        // Fallback: match by email if userId wasn't linked yet
        if (!teamMembership) {
            const userProfile = await User.findById(userId).lean();
            const userEmail = userProfile?.email?.toLowerCase();
            if (userEmail) {
                // Prefer already-approved email-linked invite
                teamMembership = await StoreUser.findOne({
                    email: userEmail,
                    status: 'approved'
                }).sort({ updatedAt: -1 }).lean();

                // If not approved yet, allow linking latest pending/invited invite to this user.
                if (!teamMembership) {
                    teamMembership = await StoreUser.findOne({
                    email: userEmail,
                    status: { $in: ['invited', 'pending'] }
                    }).sort({ updatedAt: -1 }).lean();
                }

                if (teamMembership && !teamMembership.userId) {
                    await StoreUser.findByIdAndUpdate(teamMembership._id, {
                        userId: userId,
                        status: 'approved'
                    });
                    console.log('[authSeller] Linked team membership by email:', teamMembership.storeId);

                    // Ensure the in-memory object reflects approval for downstream checks.
                    teamMembership = {
                        ...teamMembership,
                        userId,
                        status: 'approved'
                    };
                }
            }
        }

        if (teamMembership) {
            console.log('[authSeller] Found team membership:', teamMembership.storeId);
            const store = await Store.findById(teamMembership.storeId).lean();
            if (store && store.status !== 'rejected') {
                console.log('[authSeller] User has access to store via team membership:', store._id, 'status:', store.status || 'missing');
                return store._id.toString();
            }
        }

        // Second check: User owns a store
        const ownedStore = await Store.findOne({ userId: userId }).lean();
        console.log('[authSeller] Owned store found:', ownedStore ? `Yes (${ownedStore._id})` : 'No');
        console.log('[authSeller] Owned store status:', ownedStore?.status);

        if (ownedStore && ownedStore.status !== 'rejected') {
            const status = ownedStore.status || 'missing';
            console.log('[authSeller] User owns store with status:', status, ownedStore._id);
            return ownedStore._id.toString();
        }
        
        console.log('[authSeller] User has no seller access');
        return false;
    } catch (error) {
        console.log('[authSeller] Error:', error);
        return false;
    }
}

export default authSeller