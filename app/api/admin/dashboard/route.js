export const dynamic = 'force-dynamic'

import dbConnect from "@/lib/mongodb";
import Order from "@/models/Order";
import Store from "@/models/Store";
import Product from "@/models/Product";
import { NextResponse } from "next/server";

// Get Dashboard Data for Admin ( total orders, total stores, total products, total revenue )

export async function GET(request){

    try {
        await dbConnect();

        // Get total orders
        const orders = await Order.countDocuments();
        // Get total stores on app
        const stores = await Store.countDocuments();
        // get all orders include only createdAt and total & calculate total revenue
        const allOrders = await Order.find({}, { createdAt: 1, total: 1, userId: 1 });

        let totalRevenue = 0;
        allOrders.forEach(order => {
            totalRevenue += order.total || 0;
        });

        const revenue = totalRevenue.toFixed(2);
        // total products on app
        const products = await Product.countDocuments();

        // Get total unique customers (users who have placed orders)
        const uniqueUserIds = new Set(allOrders.map(order => order.userId).filter(Boolean));
        const customers = uniqueUserIds.size;

        const dashboardData = {
            orders,
            stores,
            products,
            revenue,
            customers,
            allOrders
        };

        return NextResponse.json({ dashboardData });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: error.code || error.message }, { status: 400 });
    }
}
