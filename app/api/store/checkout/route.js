export const dynamic = 'force-dynamic'

import { NextResponse } from "next/server";
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import User from '@/models/User';

// Customer order placement (guest or logged-in)
export async function POST(request) {
  try {
    await connectDB();
    
    const data = await request.json();
    // Required fields for India
    const { name, email, phone, address, state, pincode, cartItems, userId } = data;
    if (!name || !phone || !address || !state || !pincode || !cartItems || cartItems.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Optionally associate with user if logged in
    let user = null;
    if (userId) {
      user = await User.findById(userId).lean();
    }

    // Create order
    const order = await Order.create({
      userId: user ? user._id.toString() : null,
      name,
      email,
      phone,
      address,
      state,
      pincode,
      orderItems: cartItems.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
      })),
      status: "pending",
    });

    // Populate order with items
    const populatedOrder = await Order.findById(order._id)
      .populate({
        path: 'orderItems.productId',
        model: 'Product'
      })
      .lean();

    return NextResponse.json({ message: "Order placed successfully", order: populatedOrder });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.code || error.message }, { status: 400 });
  }
}
