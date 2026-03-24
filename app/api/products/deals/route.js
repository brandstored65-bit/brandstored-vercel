import dbConnect from "@/lib/mongodb";
import Product from "@/models/Product";
import Rating from "@/models/Rating";
import Category from "@/models/Category";
import { NextResponse } from "next/server";
import { getCachedData, setCachedData, generateCacheKey } from "@/lib/cache";

export async function GET(request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(request.url);
        const minDiscount = parseInt(searchParams.get('minDiscount') || '60', 10);
        const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50); // Default 20, max 50
        const offset = parseInt(searchParams.get('offset') || '0', 10);
        
        // CHECK CACHE FIRST - Skip MongoDB if cached!
        const cacheKey = generateCacheKey('deals', { minDiscount, limit, offset });
        try {
            const cachedResult = getCachedData(cacheKey);
            if (cachedResult) {
                return NextResponse.json(cachedResult, {
                    headers: {
                        'Cache-Control': 'public, s-maxage=1200, stale-while-revalidate=2400',
                        'X-Cache': 'HIT'
                    }
                });
            }
        } catch (cacheErr) {
            console.error('Cache error:', cacheErr.message);
            // Continue without cache if cache fails
        }

        // OPTIMIZED: Use MongoDB aggregation pipeline to filter discount at database level
        // Calculate discount percentage directly in MongoDB (much faster than JavaScript)
        const aggregationPipeline = [
            { 
                $match: { 
                    inStock: true,
                    AED: { $exists: true, $ne: null },
                    price: { $exists: true, $ne: null }
                } 
            },
            {
                $addFields: {
                    discount: {
                        $round: [
                            {
                                $multiply: [
                                    { $divide: [{ $subtract: ['$AED', '$price'] }, '$AED'] },
                                    100
                                ]
                            }
                        ]
                    }
                }
            },
            { $match: { discount: { $gte: minDiscount } } }, // Filter by discount in database!
            {
                $lookup: {
                    from: 'categories',
                    localField: 'category',
                    foreignField: '_id',
                    as: 'categoryData'
                }
            },
            {
                $addFields: {
                    category: { $arrayElemAt: ['$categoryData.name', 0] }
                }
            },
            { $project: { categoryData: 0 } }, // Remove temp field
            { $sort: { discount: -1 } }, // Sort by highest discount first
            { $skip: offset },
            { $limit: limit }
        ];

        let products = await Product.aggregate(aggregationPipeline).exec();
        
        // Get total count separately (more efficient)
        const countPipeline = [
            { 
                $match: { 
                    inStock: true,
                    AED: { $exists: true, $ne: null },
                    price: { $exists: true, $ne: null }
                } 
            },
            {
                $addFields: {
                    discount: {
                        $round: [
                            {
                                $multiply: [
                                    { $divide: [{ $subtract: ['$AED', '$price'] }, '$AED'] },
                                    100
                                ]
                            }
                        ]
                    }
                }
            },
            { $match: { discount: { $gte: minDiscount } } },
            { $count: 'total' }
        ];
        
        const countResult = await Product.aggregate(countPipeline).exec();
        const totalDeals = countResult[0]?.total || 0;

        // FIX N+1: Batch fetch all ratings in ONE query (not per product)
        const productIds = products.map(p => String(p._id));
        const allRatings = await Rating.find({ 
            productId: { $in: productIds }, 
            approved: true 
        }).select('productId rating').lean();
        
        // Create a map of productId -> ratings for O(1) lookup
        const ratingsMap = {};
        allRatings.forEach(review => {
            if (!ratingsMap[review.productId]) {
                ratingsMap[review.productId] = [];
            }
            ratingsMap[review.productId].push(review.rating);
        });

        // Enrich products with additional info - NO MORE INDIVIDUAL QUERIES!
        products = products.map(product => {
            try {
                // Discount already calculated in aggregation pipeline
                const discount = product.discount || 0;
                let label = `${discount}% OFF`;
                let labelType = 'offer';

                if (discount >= 70) {
                    label = `MEGA DEAL! ${discount}% OFF`;
                    labelType = 'mega-offer';
                } else if (discount >= 60) {
                    label = `HOT DEAL! ${discount}% OFF`;
                    labelType = 'hot-offer';
                }

                // Get cached ratings for this product - O(1) lookup!
                const reviews = ratingsMap[String(product._id)] || [];
                const ratingCount = reviews.length;
                const averageRating = ratingCount > 0 
                    ? (reviews.reduce((sum, r) => sum + r, 0) / ratingCount) 
                    : 0;

                // Calculate savings
                const savings = product.AED - product.price;

                return {
                    ...product,
                    discount,
                    savings,
                    label,
                    labelType,
                    ratingCount,
                    averageRating
                };
            } catch (err) {
                console.error('Error enriching deal product:', err);
                const discount = product.discount || 0;
                
                return {
                    ...product,
                    discount,
                    savings: product.AED - product.price,
                    label: `${discount}% OFF`,
                    labelType: 'offer',
                    ratingCount: 0,
                    averageRating: 0
                };
            }
        });

        // Sort by discount percentage (highest first)
        products.sort((a, b) => b.discount - a.discount);

        // CACHE RESULTS - Store in memory for 20 minutes (with error handling)
        try {
            setCachedData(cacheKey, {
                products,
                totalDeals,
                hasMore: (offset + limit) < totalDeals,
                minDiscount
            }, 1200);
        } catch (cacheErr) {
            console.error('Cache set error:', cacheErr.message);
            // Continue without cache if cache fails
        }

        return NextResponse.json({ 
            products,
            totalDeals,
            hasMore: (offset + limit) < totalDeals,
            minDiscount
        }, {
            headers: {
                'Cache-Control': 'public, s-maxage=1200, stale-while-revalidate=2400' // 20 min cache, 40 min stale
            }
        });
    } catch (error) {
        console.error('Error in deals API:', error);
        return NextResponse.json({ 
            error: "Failed to fetch deals", 
            details: error.message 
        }, { status: 500 });
    }
}
