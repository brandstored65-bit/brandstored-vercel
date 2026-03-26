'use client'
import { ArrowRight, StarIcon } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useState, useEffect, useMemo } from "react"
import ReviewForm from "./ReviewForm"
import axios from "axios"
import ProductCard from "./ProductCard"
import { useSelector } from "react-redux"
import { normalizeProductDescriptionHtml } from "@/lib/normalizeProductDescription"

// Helper function to get relative time
const getRelativeTime = (dateString) => {
    const now = new Date()
    const date = new Date(dateString)
    const diffInMs = now - date
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))
    
    if (diffInDays === 0) return 'Today'
    if (diffInDays === 1) return 'Yesterday'
    if (diffInDays < 7) return `${diffInDays} days ago`
    if (diffInDays < 14) return 'Last week'
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`
    if (diffInDays < 60) return 'Last month'
    
    // For older dates, show month and year
    const month = date.toLocaleDateString('en-US', { month: 'short' })
    const year = date.getFullYear()
    return `${month} ${year}`
}

// Updated design - Noon.com style v2
const ProductDescription = ({ product, reviews = [], loadingReviews = false, onReviewAdded }) => {

    // Use reviews and loadingReviews from props only
    const [suggestedProducts, setSuggestedProducts] = useState([])
    const allProducts = useSelector((state) => state.product.list || [])
    const [lightboxImage, setLightboxImage] = useState(null)
    const [visibleReviews, setVisibleReviews] = useState(5)
    const normalizedDescription = useMemo(() => normalizeProductDescriptionHtml(product.description || ''), [product.description])

    // Calculate rating distribution
    const ratingCounts = [0, 0, 0, 0, 0]
    reviews.forEach(review => {
        if (review.rating >= 1 && review.rating <= 5) {
            ratingCounts[review.rating - 1]++
        }
    })

    const averageRating = reviews.length > 0
        ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
        : 0

    useEffect(() => {
        fetchSuggestedProducts()
    }, [product._id, allProducts])

    const fetchSuggestedProducts = () => {
        // Filter products by same category or tags, exclude current product
        const related = allProducts.filter(p => {
            if (p._id === product._id) return false
            
            // Match by category
            if (p.category === product.category) return true
            
            // Match by tags if they exist
            if (product.tags && p.tags) {
                const productTags = Array.isArray(product.tags) ? product.tags : []
                const pTags = Array.isArray(p.tags) ? p.tags : []
                return productTags.some(tag => pTags.includes(tag))
            }
            
            return false
        })
        
        // Shuffle and take first 8 products
        const shuffled = related.sort(() => 0.5 - Math.random())
        setSuggestedProducts(shuffled.slice(0, 8))
    }

    // Remove fetchReviews and handleReviewAdded, use parent handler

    return (
        <div className="my-4 sm:my-8 -mx-0 md:mx-0">

            {/* Product Description Section */}
            <div className="bg-white border-0 md:border md:border-gray-200 mb-4 sm:mb-6">
                <div className="border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4">
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900">Product Description</h2>
                </div>
                <div className="p-4 sm:p-6">
                    <div 
                        className="max-w-none
                        [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-gray-900 [&_h1]:mb-4 [&_h1]:mt-4
                        [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-gray-900 [&_h2]:mb-3 [&_h2]:mt-3
                        [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-gray-900 [&_h3]:mb-2 [&_h3]:mt-2
                        [&_p]:text-gray-700 [&_p]:leading-relaxed [&_p]:mb-4
                        [&_strong]:font-semibold [&_strong]:text-gray-900
                        [&_em]:italic [&_em]:text-gray-800
                        [&_u]:underline
                        [&_ul]:list-disc [&_ul]:list-inside [&_ul]:text-gray-700 [&_ul]:mb-4 [&_ul]:ml-4
                        [&_ol]:list-decimal [&_ol]:list-inside [&_ol]:text-gray-700 [&_ol]:mb-4 [&_ol]:ml-4
                        [&_li]:text-gray-700 [&_li]:mb-1
                        [&_a]:text-blue-600 [&_a]:underline [&_a:hover]:text-blue-800
                        [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_img]:shadow-sm [&_img]:my-4
                        [&_video]:max-w-full [&_video]:w-full [&_video]:h-auto [&_video]:rounded-lg [&_video]:shadow-sm [&_video]:my-4
                        [&_figure]:my-6 [&_figure]:text-center
                        [&_figcaption]:text-sm [&_figcaption]:text-gray-600 [&_figcaption]:mt-2
                        [&_blockquote]:border-l-4 [&_blockquote]:border-orange-500 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-gray-700 [&_blockquote]:my-4
                        [&_code]:bg-gray-100 [&_code]:px-2 [&_code]:py-1 [&_code]:rounded [&_code]:text-sm [&_code]:font-mono [&_code]:text-red-600
                        [&_pre]:bg-gray-900 [&_pre]:text-gray-100 [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:my-4
                        [&_pre_code]:bg-none [&_pre_code]:text-inherit [&_pre_code]:p-0
                        [&_hr]:border-t-2 [&_hr]:border-gray-300 [&_hr]:my-6
                        [&_table]:w-full [&_table]:border-collapse [&_table]:my-6 [&_table]:border [&_table]:border-gray-300
                        [&_thead]:bg-gray-100
                        [&_thead_th]:text-left [&_thead_th]:px-4 [&_thead_th]:py-3 [&_thead_th]:font-semibold [&_thead_th]:text-gray-800 [&_thead_th]:border [&_thead_th]:border-gray-300
                        [&_tbody_tr]:border-b [&_tbody_tr]:border-gray-300
                        [&_tbody_tr:hover]:bg-gray-50
                        [&_tbody_tr:last-child]:border-b-0
                        [&_tbody_td]:px-4 [&_tbody_td]:py-3 [&_tbody_td]:text-gray-700 [&_tbody_td]:border [&_tbody_td]:border-gray-300
                        [&_tfoot_th]:text-left [&_tfoot_th]:px-4 [&_tfoot_th]:py-3 [&_tfoot_th]:font-semibold [&_tfoot_th]:text-gray-800 [&_tfoot_th]:border [&_tfoot_th]:border-gray-300 [&_tfoot_th]:bg-gray-50
                        [&_br]:block"
                        dangerouslySetInnerHTML={{ __html: normalizedDescription }}
                    />
                </div>
            </div>

            {/* Reviews Section */}
            <div id="reviews" className="bg-white border-0 md:border md:border-gray-200 mt-4 sm:mt-6">
                <div className="border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4">
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900">Reviews</h2>
                </div>
                <div className="p-4 sm:p-8">
                    {/* Rating Overview - Horizontal Layout */}
                    <div className="mb-6 sm:mb-10">
                        <div className="flex items-start gap-4 sm:gap-8 pb-4 sm:pb-8 border-b border-gray-200">
                            {/* Left: Large Rating */}
                            <div className="flex flex-col items-center min-w-[100px] sm:min-w-[120px]">
                                <div className="text-5xl sm:text-6xl font-bold text-gray-900 mb-2">{averageRating}</div>
                                <div className="flex mb-2">
                                    {Array(5).fill('').map((_, i) => (
                                        <StarIcon
                                            key={i}
                                            size={20}
                                            fill={i < Math.round(averageRating) ? "#FFA500" : "#D1D5DB"}
                                            className="text-transparent"
                                        />
                                    ))}
                                </div>
                                <div className="text-sm text-gray-500">{reviews.length} Review{reviews.length !== 1 ? 's' : ''}</div>
                            </div>

                            {/* Right: Rating Distribution Bars */}
                            <div className="flex-1 space-y-2">
                                {[5, 4, 3, 2, 1].map((star) => {
                                    const count = ratingCounts[star - 1]
                                    const percentage = reviews.length > 0 ? (count / reviews.length) * 100 : 0
                                    return (
                                        <div key={star} className="flex items-center gap-3">
                                            <div className="flex items-center gap-1 min-w-[45px]">
                                                <span className="text-sm font-medium text-gray-700">{star}</span>
                                                <StarIcon size={14} fill="#FFA500" className="text-transparent" />
                                            </div>
                                            <div className="flex-1 bg-gray-200 h-2.5 rounded-full overflow-hidden max-w-md">
                                                <div 
                                                    className="bg-gradient-to-r from-orange-400 to-red-500 h-full transition-all duration-300"
                                                    style={{ width: `${percentage}%` }}
                                                />
                                            </div>
                                            <span className="min-w-[25px] text-right text-sm text-gray-600">{count}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Add Review Section */}
                    <div className="mb-8 pb-8 border-b border-gray-200">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Add Review</h3>
                        <p className="text-sm text-gray-600 mb-4">
                            You can add your review by clicking the star rating below:
                        </p>
                        <ReviewForm productId={product._id} onReviewAdded={onReviewAdded} />
                    </div>

                    {/* Customer Photos Section */}
                    {reviews.some(r => r.images && r.images.length > 0) && (
                        <div className="mb-8 pb-8 border-b border-gray-200">
                            <h3 className="text-lg font-bold text-gray-900 mb-4">Customer Photos ({reviews.reduce((acc, r) => acc + (r.images?.length || 0), 0)})</h3>
                            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                                {reviews.flatMap(review => review.images || []).map((img, idx) => (
                                    <div key={idx} className="relative aspect-square group">
                                        <Image
                                            src={img}
                                            alt={`Customer photo ${idx + 1}`}
                                            fill
                                            className="rounded-lg object-cover border border-gray-200 hover:border-orange-400 transition-all cursor-pointer hover:scale-105"
                                            onClick={() => setLightboxImage(img)}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Reviews List */}
                    {loadingReviews ? (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                        </div>
                    ) : reviews.length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 rounded-lg">
                            <p className="text-gray-500">No reviews yet. Be the first to review!</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {reviews.slice(0, visibleReviews).map((item, idx) => (
                                <div key={item.id || item._id || idx} className="pb-6 border-b border-gray-100 last:border-0">
                                    <div className="flex gap-4">
                                        {/* User Avatar */}
                                        <div className="flex-shrink-0">
                                            <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-700 font-bold text-lg">
                                                {(item.user?.name || item.userId?.name || item.customerName) ? (item.user?.name || item.userId?.name || item.customerName)[0].toUpperCase() : 'U'}
                                            </div>
                                        </div>
                                        
                                        {/* Review Content */}
                                        <div className="flex-1">
                                            {/* User Info & Rating */}
                                            <div className="flex items-start justify-between mb-2">
                                            <div>
                                                    <p className="font-semibold text-gray-900">{item.user?.name || item.userId?.name || item.customerName || 'Guest User'}</p>
                                                    <p className="text-xs text-gray-500 mt-0.5">
                                                        {getRelativeTime(item.createdAt)}
                                                    </p>
                                                </div> 
                                                <div className="flex items-center gap-0.5">
                                                    {Array(5).fill('').map((_, index) => (
                                                        <StarIcon 
                                                            key={index} 
                                                            size={14} 
                                                            className='text-transparent' 
                                                            fill={item.rating >= index + 1 ? "#FFA500" : "#D1D5DB"} 
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                            
                                            {/* Review Text */}
                                            <p className="text-sm text-gray-700 leading-relaxed mb-3">{item.review}</p>
                                            
                                            {/* Review Images */}
                                            {item.images && item.images.length > 0 && (
                                                <div className="flex gap-2 flex-wrap mb-3">
                                                    {item.images.map((img, idx) => (
                                                        <div key={idx} className="relative group">
                                                            <Image
                                                                src={img}
                                                                alt={`Review image ${idx + 1}`}
                                                                width={80}
                                                                height={80}
                                                                className="rounded-lg object-cover border border-gray-200 hover:border-orange-400 transition-colors cursor-pointer"
                                                                onClick={() => setLightboxImage(img)}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            
                                            {/* Country Flag */}
                                            {/* <div className="flex items-center gap-2 text-xs text-gray-500">
                                                <span>🇦🇪</span>
                                            </div> */}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            
                            {/* Load More Button */}
                            {reviews.length > visibleReviews && (
                                <div className="text-center pt-6">
                                    <button
                                        onClick={() => setVisibleReviews(prev => prev + 5)}
                                        className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors"
                                    >
                                        Load More Reviews ({reviews.length - visibleReviews} more)
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Suggested Products Section */}
            {suggestedProducts.length > 0 && (
                <div className="bg-white border-0 md:border md:border-gray-200 mt-6">
                    <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                        <h2 className="text-xl font-bold text-gray-900">You May Also Like</h2>
                        {product.category && (
                            <Link 
                                href={`/shop?category=${product.category}`}
                                className="text-sm text-orange-500 hover:text-orange-600 font-medium flex items-center gap-1"
                            >
                                View All <ArrowRight size={16} />
                            </Link>
                        )}
                    </div>
                    <div className="p-6">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                            {suggestedProducts.map((suggestedProduct) => (
                                <ProductCard key={suggestedProduct._id} product={suggestedProduct} />
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Image Lightbox Modal */}
            {lightboxImage && (
                <div 
                    className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
                    onClick={() => setLightboxImage(null)}
                >
                    <div className="relative max-w-4xl max-h-[90vh]">
                        <button
                            onClick={() => setLightboxImage(null)}
                            className="absolute -top-10 right-0 text-white hover:text-gray-300 text-2xl font-bold"
                        >
                            ×
                        </button>
                        <Image
                            src={lightboxImage}
                            alt="Review image full size"
                            width={800}
                            height={800}
                            className="rounded-lg max-h-[85vh] w-auto object-contain"
                        />
                    </div>
                </div>
            )}
           
        </div>
    )
}

export default ProductDescription
