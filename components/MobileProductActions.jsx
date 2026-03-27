'use client'

import { EyeIcon, Plus, ShoppingCart } from 'lucide-react'

export default function MobileProductActions({ 
  onOrderNow, 
  onAddToCart,
  effPrice,
  currency,
  cartCount,
  isOutOfStock = false,
  isOrdering = false,
  showViewingMessage = false,
  viewingCount = 0
}) {
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white shadow-2xl z-50 safe-area-bottom">
      <div className="px-4 py-3">
        <div className="flex items-center gap-3">
        {/* Order Now Button */}
        <button
          onClick={onOrderNow}
          disabled={isOutOfStock || isOrdering}
          className={`flex-1 flex items-center justify-center gap-2 h-12 rounded-lg font-bold text-white transition-all shadow-md ${
            (isOutOfStock || isOrdering)
              ? 'bg-gray-400 cursor-not-allowed opacity-70' 
              : 'bg-red-500 active:bg-red-600'
          }`}
        >
          {isOutOfStock ? (
            <span className="text-base">Out of Stock</span>
          ) : isOrdering ? (
            <span className="qf-order-loader" aria-label="Processing order">
              <ShoppingCart size={18} className="qf-order-loader-icon text-white" strokeWidth={2.5} />
              <span className="qf-order-loader-dots">
                <span className="qf-order-dot w-1.5 h-1.5 rounded-full bg-white/95" />
                <span className="qf-order-dot w-1.5 h-1.5 rounded-full bg-white/95" style={{ animationDelay: '120ms' }} />
                <span className="qf-order-dot w-1.5 h-1.5 rounded-full bg-white/95" style={{ animationDelay: '240ms' }} />
              </span>
            </span>
          ) : (
            <>
              <span className="text-base">Order Now</span>
              <Plus size={20} strokeWidth={3} />
            </>
          )}
        </button>

        {/* Add to Cart Button - Hidden when out of stock */}
        {!isOutOfStock && (
          <button
            onClick={onAddToCart}
            className="relative flex items-center justify-center w-16 h-12 rounded-lg transition-all shadow-md bg-red-600 active:bg-red-700"
          >
            <ShoppingCart size={24} className="text-white" strokeWidth={2.5} />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1" style={{ backgroundColor: '#DC013C' }}>
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </button>
        )}
        </div>
        <div
          className={`overflow-hidden transition-all duration-500 ease-out ${showViewingMessage ? 'max-h-12 opacity-100 translate-y-0 mt-2' : 'max-h-0 opacity-0 -translate-y-1 mt-0'}`}
        >
          <p className="text-center text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2 inline-flex items-center justify-center gap-1.5 w-full">
            <EyeIcon size={14} className="text-emerald-600 animate-pulse" />
            <span key={viewingCount} className="animate-fadeIn">{viewingCount}</span>
            <span>customers are viewing this product now</span>
          </p>
        </div>
      </div>
    </div>
  )
}
