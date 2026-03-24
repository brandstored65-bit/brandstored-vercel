"use client";
import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";

export default function ProductFilterSidebar({ 
  products = [], 
  onFilterChange = () => {},
  initialFilters = {}
}) {
  const [mounted, setMounted] = useState(false);
  const [filters, setFilters] = useState({
    categories: [],
    priceRange: { min: 0, max: 100000 },
    rating: 0,
    inStock: false,
    ...initialFilters
  });

  const [expandedSections, setExpandedSections] = useState({
    category: true,
    price: true,
    rating: true,
    availability: true
  });

  const [sortBy, setSortBy] = useState("popularity");
  const [categorySearch, setCategorySearch] = useState("");

  // Extract unique categories and max price from products
  const [availableFilters, setAvailableFilters] = useState({
    categories: [],
    maxPrice: 10000
  });
  const [categoryVisibleCount, setCategoryVisibleCount] = useState(6); // show first 6 categories, then add 10 on demand

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (products && products.length > 0) {
      const categories = new Set();
      let maxPrice = 0;

      products.forEach(product => {
        // Only add valid category names (not ObjectIds)
        const isValidCategory = (cat) => {
          return cat && 
                 cat.length < 50 && 
                 !/^[a-f0-9]{24}$/i.test(cat) && // Exclude MongoDB ObjectIds
                 !/^[0-9a-f]{12,}$/i.test(cat);  // Exclude any hex strings
        };

        if (product.category && isValidCategory(product.category)) {
          categories.add(product.category);
        }
        if (product.categories && Array.isArray(product.categories)) {
          product.categories.forEach(cat => {
            if (isValidCategory(cat)) {
              categories.add(cat);
            }
          });
        }
        if (product.price > maxPrice) maxPrice = product.price;
      });

      setAvailableFilters({
        categories: Array.from(categories).sort(),
        maxPrice: Math.ceil(maxPrice)
      });

      setFilters(prev => ({
        ...prev,
        priceRange: { ...prev.priceRange, max: Math.ceil(maxPrice) }
      }));
    }
  }, [products]);

  useEffect(() => {
    const timer = setTimeout(() => {
      onFilterChange({ ...filters, sortBy });
    }, 300);
    return () => clearTimeout(timer);
  }, [filters, sortBy, onFilterChange]);

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleCheckbox = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: prev[filterType].includes(value)
        ? prev[filterType].filter(v => v !== value)
        : [...prev[filterType], value]
    }));
  };

  const handlePriceChange = (type, value) => {
    setFilters(prev => ({
      ...prev,
      priceRange: {
        ...prev.priceRange,
        [type]: parseInt(value) || 0
      }
    }));
  };

  const handleRatingChange = (rating) => {
    setFilters(prev => ({
      ...prev,
      rating: prev.rating === rating ? 0 : rating
    }));
  };

  const clearAllFilters = () => {
    setFilters({
      categories: [],
      priceRange: { min: 0, max: availableFilters.maxPrice },
      rating: 0,
      inStock: false
    });
    setSortBy("popularity");
  };

  const hasActiveFilters = () => {
    return filters.categories.length > 0 ||
           filters.rating > 0 ||
           filters.inStock ||
           sortBy !== "popularity";
  };

  const filteredCategories = availableFilters.categories.filter(cat =>
    cat.toLowerCase().includes(categorySearch.toLowerCase())
  );

  const visibleCategories = filteredCategories.slice(0, categoryVisibleCount);
  const canShowMore = filteredCategories.length > categoryVisibleCount;

  // Reset visible count when the filtered list shrinks (e.g., search applied)
  useEffect(() => {
    setCategoryVisibleCount(6);
  }, [categorySearch]);

  return (
    <div className="w-full lg:w-72 bg-white border border-gray-200 rounded-lg p-4 h-fit sticky top-20 overflow-y-auto max-h-[calc(100vh-100px)]">
      {/* Sort By */}
      <div className="mb-6">
        <label className="text-sm font-semibold text-gray-800 mb-3 block">
          Sort by
        </label>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
        >
          <option value="popularity">Popularity</option>
          <option value="price-low-high">Price: Low to High</option>
          <option value="price-high-low">Price: High to Low</option>
          <option value="newest">Newest First</option>
          <option value="rating">Customer Rating</option>
          <option value="discount">Discount</option>
        </select>
      </div>

      {/* Filters Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
        <h3 className="text-lg font-bold text-gray-900">FILTERS</h3>
        {hasActiveFilters() && (
          <button
            onClick={clearAllFilters}
            className="text-xs text-orange-600 hover:text-orange-700 font-semibold"
          >
            Clear All
          </button>
        )}
      </div>

      <div className="text-sm text-gray-600 mb-4" suppressHydrationWarning>
        {mounted ? `${products?.length || 0} Products` : 'Products'}
      </div>

      <div className="space-y-4">
        {/* Category Filter */}
        {availableFilters.categories.length > 0 && (
          <div className="border-b border-gray-200 pb-4">
            <button
              onClick={() => toggleSection('category')}
              className="flex items-center justify-between w-full text-left font-semibold text-gray-900 mb-3"
            >
              Category
              {expandedSections.category ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            
            {expandedSections.category && (
              <div>
                {/* Search */}
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    placeholder="Search categories"
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  {categorySearch && (
                    <button
                      onClick={() => setCategorySearch("")}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                {/* Category List */}
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {visibleCategories.map((category) => (
                    <label key={category} className="flex items-center space-x-2 cursor-pointer hover:bg-orange-50 p-1.5 rounded">
                      <input
                        type="checkbox"
                        checked={filters.categories.includes(category)}
                        onChange={() => handleCheckbox('categories', category)}
                        className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                      />
                      <span className="text-sm text-gray-700">{category}</span>
                    </label>
                  ))}
                </div>

                {filteredCategories.length > 0 && (
                  <div className="mt-2">
                    {canShowMore ? (
                      <button
                        onClick={() => setCategoryVisibleCount(prev => prev + 10)}
                        className="text-sm font-semibold text-orange-600 hover:text-orange-700"
                      >
                        Show more ({filteredCategories.length - visibleCategories.length} more)
                      </button>
                    ) : (
                      filteredCategories.length > 6 && (
                        <button
                          onClick={() => setCategoryVisibleCount(6)}
                          className="text-sm font-semibold text-orange-600 hover:text-orange-700"
                        >
                          Show less
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Price Filter */}
        <div className="border-b border-gray-200 pb-4">
          <button
            onClick={() => toggleSection('price')}
            className="flex items-center justify-between w-full text-left font-semibold text-gray-900 mb-3"
          >
            Price Range
            {expandedSections.price ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          
          {expandedSections.price && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  placeholder="Min"
                  value={filters.priceRange.min}
                  onChange={(e) => handlePriceChange('min', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <span className="text-gray-500 text-sm">to</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={filters.priceRange.max}
                  onChange={(e) => handlePriceChange('max', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div className="px-1">
                <input
                  type="range"
                  min="0"
                  max={availableFilters.maxPrice}
                  value={filters.priceRange.max}
                  onChange={(e) => handlePriceChange('max', e.target.value)}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-600"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>AED0</span>
                  <span>AED{availableFilters.maxPrice}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Rating Filter */}
        <div className="border-b border-gray-200 pb-4">
          <button
            onClick={() => toggleSection('rating')}
            className="flex items-center justify-between w-full text-left font-semibold text-gray-900 mb-3"
          >
            Customer Rating
            {expandedSections.rating ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          
          {expandedSections.rating && (
            <div className="space-y-2">
              {[4, 3, 2, 1].map((rating) => (
                <label key={rating} className="flex items-center space-x-2 cursor-pointer hover:bg-orange-50 p-1.5 rounded">
                  <input
                    type="radio"
                    name="rating"
                    checked={filters.rating === rating}
                    onChange={() => handleRatingChange(rating)}
                    className="w-4 h-4 text-orange-600 border-gray-300 focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-700 flex items-center">
                    {rating}★ & above
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Availability Filter */}
        <div className="pb-2">
          <button
            onClick={() => toggleSection('availability')}
            className="flex items-center justify-between w-full text-left font-semibold text-gray-900 mb-3"
          >
            Availability
            {expandedSections.availability ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          
          {expandedSections.availability && (
            <label className="flex items-center space-x-2 cursor-pointer hover:bg-orange-50 p-1.5 rounded">
              <input
                type="checkbox"
                checked={filters.inStock}
                onChange={(e) => setFilters(prev => ({ ...prev, inStock: e.target.checked }))}
                className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
              />
              <span className="text-sm text-gray-700">In Stock Only</span>
            </label>
          )}
        </div>
      </div>
    </div>
  );
}
