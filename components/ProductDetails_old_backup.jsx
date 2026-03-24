'use client'

import { StarIcon, Share2Icon, HeartIcon, TruckIcon, ShieldCheckIcon, RotateCcwIcon, PackageIcon, ZoomInIcon, Copy, Check, MinusIcon, PlusIcon } from "lucide-react";
import Image from "next/image";
import { useState, useEffect } from "react";

import { useRouter } from "next/navigation";
import axios from "axios";
import { useDispatch, useSelector } from "react-redux";
import { addToCart } from "@/lib/features/cart/cartSlice";
import Counter from "./Counter";
import MobileProductActions from "./MobileProductActions";

const ProductDetails = ({ product }) => {
  const currency = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || 'AED ';
  const [mainImage, setMainImage] = useState(product.images?.[0]);
  const [quantity, setQuantity] = useState(1);
  const [isInWishlist, setIsInWishlist] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [showWishlistToast, setShowWishlistToast] = useState(false);
  const [wishlistMessage, setWishlistMessage] = useState('');
  const { isSignedIn, userId } = useAuth();
  const router = useRouter();
  const dispatch = useDispatch();
  const cartCount = useSelector((state) => state.cart.total);

  const averageRating = product.rating?.length
    ? product.rating.reduce((acc, item) => acc + item.rating, 0) / product.rating.length
    : 0;

  // Variants and pricing helpers will compute effective price/AED and discount

  // Variants support
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const bulkVariants = variants.filter(v => v?.options && (v.options.bundleQty || v.options.bundleQty === 0));
  const variantColors = [...new Set(variants.map(v => v.options?.color).filter(Boolean))];
  const variantSizes = [...new Set(variants.map(v => v.options?.size).filter(Boolean))];
  const [selectedColor, setSelectedColor] = useState(variantColors[0] || product.colors?.[0] || null);
  const [selectedSize, setSelectedSize] = useState(variantSizes[0] || product.sizes?.[0] || null);
  const [selectedBundleQty, setSelectedBundleQty] = useState(
    bulkVariants.length ? Number(bulkVariants[0].options.bundleQty) : null
  );

  const selectedVariant = (bulkVariants.length
    ? bulkVariants.find(v => Number(v.options?.bundleQty) === Number(selectedBundleQty))
    : variants.find(v => {
        const cOk = v.options?.color ? v.options.color === selectedColor : true;
        const sOk = v.options?.size ? v.options.size === selectedSize : true;
        return cOk && sOk;
      })
  ) || null;

  const effPrice = selectedVariant?.price ?? product.price;
  const effAED = selectedVariant?.AED ?? product.AED;
  const discountPercent = effAED > effPrice
    ? Math.round(((effAED - effPrice) / effAED) * 100)
    : 0;

  // Check wishlist status on mount
  useEffect(() => {
    if (isSignedIn) {
      checkWishlistStatus();
    }
  }, [isSignedIn, product._id]);

  const checkWishlistStatus = async () => {
    try {
      const { data } = await axios.get('/api/wishlist');
      const isInList = data.wishlist?.some(item => item.productId === product._id);
      setIsInWishlist(isInList);
    } catch (error) {
      console.error('Error checking wishlist status:', error);
    }
  };

  // Wishlist functionality
  const handleWishlist = async () => {
    if (!isSignedIn) {
      router.push('/sign-in');
      return;
    }

    if (wishlistLoading) return;

    try {
      setWishlistLoading(true);
      const action = isInWishlist ? 'remove' : 'add';
      await axios.post('/api/wishlist', { 
        productId: product._id, 
        action 
      });
      
      setIsInWishlist(!isInWishlist);
      setWishlistMessage(isInWishlist ? 'Removed from wishlist' : 'Added to wishlist!');
      setShowWishlistToast(true);
      
      // Dispatch event to update navbar count
      window.dispatchEvent(new Event('wishlistUpdated'));
      
      setTimeout(() => {
        setShowWishlistToast(false);
      }, 3000);
    } catch (error) {
      console.error('Error updating wishlist:', error);
      setWishlistMessage('Failed to update wishlist');
      setShowWishlistToast(true);
      setTimeout(() => setShowWishlistToast(false), 3000);
    } finally {
      setWishlistLoading(false);
    }
  };

  // Share functionality
  const handleShare = (platform) => {
    const url = window.location.href;
    const text = `Check out ${product.name}`;
    
    const shareUrls = {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    };

    if (shareUrls[platform]) {
      window.open(shareUrls[platform], '_blank', 'width=600,height=400');
      setShowShareMenu(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setShowShareMenu(false);
      }, 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // Handle Order Now - Add to cart and redirect
  const handleOrderNow = () => {
    if (!isSignedIn) {
      router.push('/sign-in');
      return;
    }

    // Add product to cart multiple times based on quantity
    for (let i = 0; i < quantity; i++) {
      dispatch(addToCart({ productId: product.id }));
    }

    // Redirect to cart page
    router.push('/cart');
  };

  // Handle Add to Cart (without redirect)
  const handleAddToCart = () => {
    if (!isSignedIn) {
      router.push('/sign-in');
      return;
    }

    // Add product to cart multiple times based on quantity
    for (let i = 0; i < quantity; i++) {
      dispatch(addToCart({ productId: product.id }));
    }
  };

  return (
    <div className="flex flex-col lg:flex-row lg:gap-8">
      {/* Left Section: Images */}
      <div className="w-full lg:w-1/2">
        <div className="flex flex-col lg:flex-row gap-3 lg:px-0">
          {/* Thumbnails - Vertical on Desktop, Hidden on Mobile */}
          <div className="hidden lg:flex flex-col gap-2 flex-shrink-0">
            {product.images?.map((image, index) => (
              <div
                key={index}
                onClick={() => setMainImage(image)}
                className={`bg-white border-2 flex items-center justify-center w-16 h-16 rounded-lg cursor-pointer transition-all ${
                  mainImage === image ? 'border-orange-500 ring-2 ring-orange-200' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Image
                  src={image}
                  alt={`${product.name} ${index}`}
                  width={60}
                  height={60}
                  className="object-contain"
                />
              </div>
            ))}
          </div>

          {/* Main Image Container */}
          <div className="flex-1">
            {/* Main Image */}
            <div className="relative w-full aspect-square bg-white border-0 lg:border border-gray-200 overflow-hidden lg:rounded-lg group">
              <Image
                src={mainImage}
                alt={product.name}
                fill
                className="object-contain lg:p-4"
                priority
              />
              
              {/* Mobile: Wishlist and Share Icons - Positioned on left side */}
              <div className="lg:hidden absolute top-4 left-4 flex flex-col gap-2 z-10">
                <button
                  onClick={handleWishlist}
                  disabled={wishlistLoading}
                  className={`w-11 h-11 rounded-full shadow-lg flex items-center justify-center transition-all ${
                    isInWishlist 
                      ? 'bg-red-500 text-white' 
                      : 'bg-white text-gray-700 border border-gray-200'
                  }`}
                >
                  <HeartIcon size={20} fill={isInWishlist ? 'currentColor' : 'none'} strokeWidth={2} />
                </button>
                
                <button
                  onClick={() => setShowShareMenu(!showShareMenu)}
                  className="w-11 h-11 rounded-full bg-white border border-gray-200 shadow-lg flex items-center justify-center text-gray-700"
                >
                  <Share2Icon size={20} strokeWidth={2} />
                </button>
              </div>

              {/* Discount Badge */}
              {discountPercent > 0 && (
                <div className="lg:hidden absolute top-4 right-0 bg-red-500 text-white px-4 py-2 rounded-l-full text-sm font-bold shadow-lg flex items-center gap-1">
                  <span className="text-yellow-300">🔥</span>
                  <span>Save {discountPercent}%</span>
                </div>
              )}

              {/* Pagination dots indicator - Mobile only */}
              <div className="lg:hidden absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 z-10">
                {product.images?.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setMainImage(product.images[index])}
                    className={`h-1.5 rounded-full transition-all ${
                      mainImage === product.images[index] 
                        ? 'w-6 bg-red-500' 
                        : 'w-1.5 bg-gray-300'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Thumbnails - Horizontal on Mobile Only */}
            <div className="flex lg:hidden gap-2 overflow-x-auto pb-2 mt-4 scrollbar-hide px-1">
              {product.images?.map((image, index) => (
                <div
                  key={index}
                  onClick={() => setMainImage(image)}
                  className={`flex-shrink-0 bg-white border-2 flex items-center justify-center w-20 h-20 rounded-lg cursor-pointer transition-all ${
                    mainImage === image ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-200'
                  }`}
                >
                  <Image
                    src={image}
                    alt={`${product.name} ${index}`}
                    width={80}
                    height={80}
                    className="object-contain p-2"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right Section: Product Details */}
      <div className="w-full lg:w-1/2 flex flex-col px-6 lg:px-0">
        {/* Shop/Brand Link */}
        <a href={`/shop/${product.store?.username}`} className="text-orange-500 text-sm font-medium hover:underline mb-2">
          Shop for {product.store?.name || 'Generic'} &gt;
        </a>

        {/* Product Name */}
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">{product.name}</h1>

        {/* Product Badges */}
        {product.attributes?.badges && product.attributes.badges.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {product.attributes.badges.map((badge, index) => (
              <span
                key={index}
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-teal-100 text-teal-700 border border-teal-200"
              >
                {badge}
              </span>
            ))}
          </div>
        )}

        {/* Short Description */}
        {product.shortDescription && (
          <p className="text-gray-600 text-sm mb-3 leading-relaxed">{product.shortDescription}</p>
        )}

        {/* Ratings & Reviews */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded">
            <StarIcon size={16} fill="#FFA500" className="text-orange-500" />
            <span className="text-sm font-semibold">{averageRating.toFixed(1)}</span>
          </div>
          <a href="#reviews" className="text-sm text-blue-600 hover:underline">
            {product.rating?.length || 0} Reviews
          </a>
        </div>

        {/* Price Section */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
          <div className="flex items-baseline gap-2 flex-wrap">
            <div className="flex items-baseline gap-1">
              <span className="text-base text-gray-600 font-medium">{currency}</span>
              <span className="text-3xl md:text-4xl font-bold text-gray-900">
                {effPrice}
              </span>
            </div>
            {(effAED > effPrice) && (
              <span className="text-lg text-gray-400 line-through">
                {currency}{effAED}
              </span>
            )}
            {discountPercent > 0 && (
              <>
                <span className="bg-orange-500 text-white px-2 py-1 rounded text-xs font-semibold">
                  Save {discountPercent}%
                </span>
                <span className="text-orange-500 text-xs font-medium">
                  Save {currency}{(effAED - effPrice).toFixed(2)}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Installment Options */}
        {/* <div className="space-y-2 mb-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-700">Or divide it into 4 monthly payments of</span>
            <span className="font-semibold">AED{(product.price / 4).toFixed(2)}</span>
            <span className="text-gray-500">only with</span>
            <span className="bg-teal-400 text-white px-2 py-0.5 rounded font-semibold text-xs">tabby</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-700">Or divide it into 3 monthly payments of</span>
            <span className="font-semibold">AED{(product.price / 3).toFixed(2)}</span>
            <span className="text-gray-500">only with</span>
            <span className="bg-orange-500 text-white px-2 py-0.5 rounded font-semibold text-xs">tamara</span>
          </div>
        </div> */}

        {/* Variants */}
        <div className="space-y-4 mb-6">
          {/* Bulk bundle variant selector */}
          {bulkVariants.length > 0 && (
            <div className="space-y-3 border-t pt-4">
              <div className="text-center">
                <p className="text-rose-600 font-bold text-sm uppercase tracking-wide">Bundle and Save More!</p>
              </div>
              <div className="flex flex-col gap-3">
                {bulkVariants
                  .slice()
                  .sort((a,b)=>Number(a.options.bundleQty)-Number(b.options.bundleQty))
                  .map((v, idx)=>{
                    const qty = Number(v.options.bundleQty) || 1;
                    const isSelected = Number(selectedBundleQty) === qty;
                    const price = Number(v.price);
                    const AED = Number(v.AED ?? v.price);
                    const save = AED > price ? (AED - price) : 0;
                    const tag = v.tag || v.options?.tag || '';
                    const label = v.options?.title?.trim() || (qty === 1 ? 'Buy 1' : `Bundle of ${qty}`);
                    const subtitle = qty === 2 ? 'Perfect for you & a friend' : qty === 3 ? 'Best Value' : '';
                    
                    return (
                      <div key={`${qty}-${idx}`} className="relative">
                        {tag === 'MOST_POPULAR' && (
                          <div className="absolute -top-2 right-4 bg-rose-500 text-white text-[10px] font-bold px-3 py-1 rounded-sm z-10">
                            MOST POPULAR
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={()=> setSelectedBundleQty(qty)}
                          className={`w-full text-left border-2 rounded-lg p-4 flex items-center justify-between gap-4 transition-all ${
                            isSelected 
                              ? 'border-rose-500 bg-rose-50/50' 
                              : 'border-gray-200 bg-white hover:border-rose-200'
                          }`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-bold text-gray-900">{label}</p>
                            </div>
                            {subtitle && (
                              <p className="text-xs text-gray-500">{subtitle}</p>
                            )}
                            {save > 0 && (
                              <span className="inline-block mt-2 text-xs font-semibold text-rose-600">You Save {currency}{save.toFixed(2)}</span>
                            )}
                          </div>
                          <div className="text-right flex flex-col items-end gap-1">
                            <div className="text-2xl font-bold text-gray-900">{currency} {price.toFixed(2)}</div>
                            {AED > price && (
                              <div className="text-sm text-gray-400 line-through">{currency} {AED.toFixed(2)}</div>
                            )}
                          </div>
                          <div className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                            isSelected ? 'border-rose-500 bg-white' : 'border-gray-300 bg-white'
                          }`}>
                            {isSelected && (
                              <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                            )}
                          </div>
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
          {/* Color Variant */}
          {(variantColors.length > 0 || product.colors?.length > 0) && (
            <div>
              <p className="font-semibold text-gray-800 mb-2">Choose color</p>
              <div className="flex gap-3 flex-wrap">
                {(variantColors.length ? variantColors : (product.colors || [])).map((color, index) => {
                  const variantWithImage = variants.find(v => v.options?.color === color && v.options?.image);
                  const imageUrl = variantWithImage?.options?.image;
                  const variantPrice = variants.find(v => v.options?.color === color)?.price;
                  const stockInfo = variants.find(v => v.options?.color === color)?.stock;
                  const inStock = stockInfo === undefined || stockInfo > 0;

                  return (
                    <button
                      key={index}
                      onClick={() => setSelectedColor(color)}
                      disabled={!inStock}
                      className={`flex flex-col items-center gap-2 transition-all ${!inStock ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className={`w-20 h-20 rounded-lg border-2 transition-all overflow-hidden flex items-center justify-center ${
                        selectedColor === color
                          ? 'border-red-500 ring-2 ring-red-200'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}>
                        {imageUrl ? (
                          <Image
                            src={imageUrl}
                            alt={color}
                            width={80}
                            height={80}
                            className="object-contain"
                          />
                        ) : (
                          <div className="w-full h-full" style={{ backgroundColor: color }}></div>
                        )}
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-medium text-gray-700">{color} {selectedColor === color && '*'}</p>
                        {variantPrice && (
                          <p className="text-xs text-green-600 font-semibold">{currency} {variantPrice}</p>
                        )}
                        <p className={`text-[10px] font-medium ${inStock ? 'text-green-600' : 'text-red-600'}`}>
                          {inStock ? 'In Stock' : 'Out of Stock'}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Size Variant */}
          {(variantSizes.length > 0 || product.sizes?.length > 0) && (
            <div>
              <p className="font-semibold text-gray-800 mb-2">Size</p>
              <div className="flex gap-2 flex-wrap">
                {(variantSizes.length ? variantSizes : (product.sizes || [])).map((size, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedSize(size)}
                    className={`px-4 py-2 border-2 rounded-md text-sm font-medium transition-all ${
                      selectedSize === size
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'border-gray-300 hover:border-orange-400'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="flex items-center gap-2 bg-blue-50 p-3 rounded-lg">
            <ShieldCheckIcon className="text-blue-600" size={20} />
            <span className="text-sm text-gray-700">1 Year Warranty</span>
          </div>
          <div className="flex items-center gap-2 bg-green-50 p-3 rounded-lg">
            <TruckIcon className="text-green-600" size={20} />
            <span className="text-sm text-gray-700">Arrives in 2 days</span>
          </div>
          <div className="flex items-center gap-2 bg-purple-50 p-3 rounded-lg">
            <PackageIcon className="text-purple-600" size={20} />
            <span className="text-sm text-gray-700">Free Shipping</span>
          </div>
          <div className="flex items-center gap-2 bg-orange-50 p-3 rounded-lg">
            <RotateCcwIcon className="text-orange-600" size={20} />
            <span className="text-sm text-gray-700">Cash On Delivery</span>
          </div>
        </div>

        {/* Quantity Selector */}
        <div className="mb-6">
          <p className="font-semibold text-gray-800 mb-3">Quantity</p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-10 h-10 flex items-center justify-center border-2 border-gray-300 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition"
            >
              <MinusIcon size={18} className="text-gray-700" />
            </button>
            <div className="w-16 h-10 flex items-center justify-center border-2 border-gray-300 rounded-lg font-semibold text-lg">
              {quantity}
            </div>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="w-10 h-10 flex items-center justify-center border-2 border-gray-300 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition"
            >
              <PlusIcon size={18} className="text-gray-700" />
            </button>
          </div>
        </div>

        {/* Action Buttons - Desktop Only */}
        <div className="hidden lg:flex gap-3 mb-4">
          {/* Buy Now Button */}
          <button 
            onClick={handleOrderNow}
            className="flex-[4] bg-red-500 text-white py-4 rounded-lg font-semibold text-lg hover:bg-red-600 transition shadow-sm flex items-center justify-center gap-2"
          >
            Buy Now
            <span className="text-xl">→</span>
          </button>

          {/* Add to Cart Button */}
          <button 
            onClick={() => {
              if (!isSignedIn) {
                router.push('/sign-in');
                return;
              }
              // Add product to cart based on quantity
              for (let i = 0; i < quantity; i++) {
                dispatch(addToCart({ productId: product.id }));
              }
              setWishlistMessage('Added to cart!');
              setShowWishlistToast(true);
              setTimeout(() => setShowWishlistToast(false), 3000);
            }}
            className="flex-1 bg-green-500 text-white py-4 rounded-lg font-semibold text-lg hover:bg-green-600 transition shadow-sm flex items-center justify-center gap-2"
          >
            Add to Cart
          </button>
        </div>

        {/* Additional Actions - Desktop Only */}
        <div className="hidden lg:flex gap-4 text-sm">
          <button 
            onClick={handleWishlist}
            disabled={wishlistLoading}
            className={`flex items-center gap-2 transition-all duration-300 transform ${
              isInWishlist 
                ? 'text-red-500 scale-110' 
                : 'text-gray-600 hover:text-red-500 hover:scale-105'
            } ${wishlistLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <HeartIcon 
              size={18} 
              fill={isInWishlist ? 'currentColor' : 'none'} 
              className={`transition-all duration-300 ${wishlistLoading ? 'animate-pulse' : ''}`}
            />
            {wishlistLoading ? 'Processing...' : (isInWishlist ? 'In Wishlist' : 'Add to Wishlist')}
          </button>
          
          <div className="relative">
            <button 
              onClick={() => setShowShareMenu(!showShareMenu)}
              className="flex items-center gap-2 text-gray-600 hover:text-orange-500 transition"
            >
              <Share2Icon size={18} />
              Share
            </button>
            
            {/* Share Menu Dropdown */}
            {showShareMenu && (
              <div className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl z-50 w-56 py-2">
                <div className="px-3 py-2 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-700">Share this product</p>
                </div>
                
                <button
                  onClick={() => handleShare('whatsapp')}
                  className="w-full px-3 py-2 flex items-center gap-3 hover:bg-gray-50 transition"
                >
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-700">WhatsApp</span>
                </button>

                <button
                  onClick={() => handleShare('facebook')}
                  className="w-full px-3 py-2 flex items-center gap-3 hover:bg-gray-50 transition"
                >
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-700">Facebook</span>
                </button>

                <button
                  onClick={() => handleShare('twitter')}
                  className="w-full px-3 py-2 flex items-center gap-3 hover:bg-gray-50 transition"
                >
                  <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-700">Twitter</span>
                </button>

                <button
                  onClick={() => handleShare('telegram')}
                  className="w-full px-3 py-2 flex items-center gap-3 hover:bg-gray-50 transition"
                >
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-700">Telegram</span>
                </button>

                <div className="border-t border-gray-100 mt-2 pt-2">
                  <button
                    onClick={copyToClipboard}
                    className="w-full px-3 py-2 flex items-center gap-3 hover:bg-gray-50 transition"
                  >
                    {copied ? (
                      <>
                        <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                          <Check size={16} className="text-white" />
                        </div>
                        <span className="text-sm font-medium text-green-600">Copied!</span>
                      </>
                    ) : (
                      <>
                        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                          <Copy size={16} className="text-gray-700" />
                        </div>
                        <span className="text-sm font-medium text-gray-700">Copy Link</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {showWishlistToast && (
        <div className="fixed bottom-8 right-8 bg-white border-2 border-orange-500 rounded-lg shadow-2xl px-6 py-4 flex items-center gap-3 z-50 animate-slide-up">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            wishlistMessage.includes('Added') ? 'bg-green-100' : 'bg-red-100'
          }`}>
            <HeartIcon 
              size={20} 
              className={wishlistMessage.includes('Added') ? 'text-green-600' : 'text-red-600'}
              fill={wishlistMessage.includes('Added') ? 'currentColor' : 'none'}
            />
          </div>
          <div>
            <p className="font-semibold text-gray-900">{wishlistMessage}</p>
            {wishlistMessage.includes('Added') && (
              <button 
                onClick={() => router.push('/wishlist')}
                className="text-sm text-orange-500 hover:underline"
              >
                View Wishlist
              </button>
            )}
          </div>
        </div>
      )}

      {/* Mobile Fixed Actions Bar */}
      <MobileProductActions
        onOrderNow={handleOrderNow}
        onAddToCart={handleAddToCart}
        effPrice={effPrice}
        currency={currency}
        cartCount={cartCount}
      />

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default ProductDetails;
