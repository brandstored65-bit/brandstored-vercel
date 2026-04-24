export const dynamic = 'force-dynamic'

import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import MetaIntegration from "@/models/MetaIntegration";
import { getAuth } from '@/lib/firebase-admin';

// GET - Fetch Meta integration settings
export async function GET(req) {
    try {
        await connectDB();
        
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        const token = authHeader.split('Bearer ')[1];
        const decoded = await getAuth().verifyIdToken(token);
        if (!decoded || !decoded.uid) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }
        
        const integration = await MetaIntegration.findOne({ storeId: 'default' });
        
        if (!integration) {
            return NextResponse.json({
                success: true,
                connected: false,
                integration: null
            });
        }
        
        return NextResponse.json({
            success: true,
            connected: true,
            integration: {
                adAccountId: integration.adAccountId,
                isActive: integration.isActive,
                lastSyncedAt: integration.lastSyncedAt,
                autoSyncEnabled: integration.autoSyncEnabled,
                syncFrequency: integration.syncFrequency
            }
        });
        
    } catch (error) {
        console.error('Meta integration fetch error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch integration settings' },
            { status: 500 }
        );
    }
}

// POST - Save Meta integration settings
export async function POST(req) {
    try {
        await connectDB();
        
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        const token = authHeader.split('Bearer ')[1];
        const decoded = await getAuth().verifyIdToken(token);
        if (!decoded || !decoded.uid) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }
        
        const body = await req.json();
        let { adAccountId, accessToken, autoSyncEnabled, syncFrequency } = body;
        
        if (!adAccountId || !accessToken) {
            return NextResponse.json(
                { error: 'Ad Account ID and Access Token are required' },
                { status: 400 }
            );
        }
        
        // Sanitize Ad Account ID - remove 'act_' prefix, extra spaces, and trim
        adAccountId = adAccountId.toString().trim().replace(/^act_/i, '').replace(/\s+/g, '');
        accessToken = accessToken.toString().trim();
        
        // Validate Ad Account ID is numeric
        if (!/^\d+$/.test(adAccountId)) {
            return NextResponse.json(
                { error: 'Invalid Ad Account ID format. Must contain only numbers (e.g., 123456789012345)' },
                { status: 400 }
            );
        }
        
        // Check if integration already exists
        let integration = await MetaIntegration.findOne({ storeId: 'default' });
        
        if (integration) {
            // Update existing
            integration.adAccountId = adAccountId;
            integration.accessToken = accessToken;
            integration.autoSyncEnabled = autoSyncEnabled !== undefined ? autoSyncEnabled : true;
            integration.syncFrequency = syncFrequency || 'DAILY';
            integration.isActive = true;
            await integration.save();
        } else {
            // Create new
            integration = new MetaIntegration({
                storeId: 'default',
                adAccountId,
                accessToken,
                autoSyncEnabled: autoSyncEnabled !== undefined ? autoSyncEnabled : true,
                syncFrequency: syncFrequency || 'DAILY',
                isActive: true
            });
            await integration.save();
        }
        
        return NextResponse.json({
            success: true,
            message: 'Meta integration connected successfully',
            integration: {
                adAccountId: integration.adAccountId,
                isActive: integration.isActive,
                autoSyncEnabled: integration.autoSyncEnabled,
                syncFrequency: integration.syncFrequency
            }
        });
        
    } catch (error) {
        console.error('Meta integration save error:', error);
        return NextResponse.json(
            { error: 'Failed to save integration settings' },
            { status: 500 }
        );
    }
}

// DELETE - Disconnect Meta integration
export async function DELETE(req) {
    try {
        await connectDB();
        
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        const token = authHeader.split('Bearer ')[1];
        const decoded = await getAuth().verifyIdToken(token);
        if (!decoded || !decoded.uid) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }
        
        await MetaIntegration.deleteOne({ storeId: 'default' });
        
        return NextResponse.json({
            success: true,
            message: 'Meta integration disconnected successfully'
        });
        
    } catch (error) {
        console.error('Meta integration delete error:', error);
        return NextResponse.json(
            { error: 'Failed to disconnect integration' },
            { status: 500 }
        );
    }
}
