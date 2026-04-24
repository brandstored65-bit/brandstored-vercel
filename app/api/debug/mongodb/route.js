export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Product from '@/models/Product';

export async function GET() {
    try {
        const diagnostics = {
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV,
            mongodbConfigured: !!process.env.MONGODB_URI,
            mongodbUriPrefix: process.env.MONGODB_URI?.substring(0, 20) + '...',
        };

        // Test MongoDB connection
        try {
            await dbConnect();
            diagnostics.connectionStatus = 'SUCCESS';
            diagnostics.connectionMessage = 'MongoDB connected successfully';
        } catch (connError) {
            diagnostics.connectionStatus = 'FAILED';
            diagnostics.connectionError = connError.message;
            return NextResponse.json({ success: false, diagnostics }, { status: 500 });
        }

        // Test product query
        try {
            const productCount = await Product.countDocuments();
            diagnostics.productCount = productCount;
            
            const sampleProducts = await Product.find()
                .limit(2)
                .select('name slug price category')
                .lean();
            
            diagnostics.sampleProducts = sampleProducts;
            diagnostics.queryStatus = 'SUCCESS';
        } catch (queryError) {
            diagnostics.queryStatus = 'FAILED';
            diagnostics.queryError = queryError.message;
        }

        return NextResponse.json({ 
            success: true, 
            diagnostics 
        });

    } catch (error) {
        return NextResponse.json({ 
            success: false, 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
}
