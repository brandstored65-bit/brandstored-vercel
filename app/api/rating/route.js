export const dynamic = 'force-dynamic'

import dbConnect from "@/lib/mongodb";
import Rating from "@/models/Rating";
import Order from "@/models/Order";

import { NextResponse } from "next/server";


// Add new rating
export async function POST(request){
    try {
        await dbConnect();
        const {orderId, productId, rating, review, userId} = await request.json();
        const order = await Order.findOne({_id: orderId, userId});

        if(!order){
            return NextResponse.json({ error: "Order not found" }, { status: 404 });
        }

         const isAlreadyRated = await Rating.findOne({productId, orderId});

         if(isAlreadyRated){
            return NextResponse.json({ error: "Product already rated" }, { status: 400 });
         }

         const response = await Rating.create({
            userId, productId, rating, review, orderId
         });

         return NextResponse.json({message: "Rating added successfully", rating: response});

      
    } catch (error) {
        console.error(error);
        return NextResponse.json({error: error.code || error.message}, { status: 400 })
    }
}

// Get all ratings for a user
export async function GET(request){
    try {
        await dbConnect();
        const {userId} = await request.json();

        if(!userId){
            return NextResponse.json({error: "Unauthorized"}, { status: 401 });
        }
        const ratings = await Rating.find({userId}).lean();

        return NextResponse.json({ratings});
    } catch (error) {
        console.error(error);
        return NextResponse.json({error: error.code || error.message}, { status: 400 })
    }
}
