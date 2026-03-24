'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/useAuth'
import axios from 'axios'
import { toast } from 'react-hot-toast'
import Image from 'next/image'
import { ChevronDown, Save, Loader } from 'lucide-react'

export default function FeaturedProducts() {
    const { getToken } = useAuth()
    const [products, setProducts] = useState([])
    const [selectedProducts, setSelectedProducts] = useState([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [sortBy, setSortBy] = useState('name')

    // Fetch all products
    const fetchProducts = async () => {
        try {
            setLoading(true)
            const token = await getToken()
            const { data } = await axios.get('/api/store/product', {
                headers: { Authorization: `Bearer ${token}` }
            })
            setProducts(data.products || [])

            // Fetch saved featured products
            const { data: savedData } = await axios.get('/api/store/featured-products', {
                headers: { Authorization: `Bearer ${token}` }
            })
            setSelectedProducts(savedData.productIds || [])
        } catch (error) {
            toast.error('Failed to load products')
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchProducts()
    }, [])

    // Handle product selection
    const toggleProduct = (productId) => {
        setSelectedProducts(prev => 
            prev.includes(productId)
                ? prev.filter(id => id !== productId)
                : [...prev, productId]
        )
    }

    // Save featured products
    const saveFeaturedProducts = async () => {
        try {
            setSaving(true)
            const token = await getToken()
            await axios.post('/api/store/featured-products', 
                { productIds: selectedProducts },
                { headers: { Authorization: `Bearer ${token}` } }
            )
            toast.success('Featured products saved successfully')
        } catch (error) {
            toast.error('Failed to save featured products')
            console.error(error)
        } finally {
            setSaving(false)
        }
    }

    // Filter and sort products
    const filteredProducts = products.filter(p => 
        p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchQuery.toLowerCase())
    ).sort((a, b) => {
        if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '')
        if (sortBy === 'price') return (a.price || 0) - (b.price || 0)
        if (sortBy === 'newest') return new Date(b.createdAt) - new Date(a.createdAt)
        return 0
    })

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader className="animate-spin" size={40} />
            </div>
        )
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-slate-800 mb-2">Featured Products</h1>
                <p className="text-slate-600">Manually select products to display in your featured section</p>
            </div>

            {/* Controls */}
            <div className="bg-white border rounded-lg p-4 mb-6 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    {/* Search */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Search Products</label>
                        <input
                            type="text"
                            placeholder="Search by name or SKU..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Sort */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Sort By</label>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="name">Product Name</option>
                            <option value="price">Price (Low to High)</option>
                            <option value="newest">Newest First</option>
                        </select>
                    </div>

                    {/* Selected Count */}
                    <div className="flex items-end">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 w-full">
                            <p className="text-sm text-blue-700 font-medium">
                                {selectedProducts.length} of {products.length} products selected
                            </p>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                    <button
                        onClick={() => setSelectedProducts(products.map(p => p._id))}
                        className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition font-medium text-sm"
                    >
                        Select All
                    </button>
                    <button
                        onClick={() => setSelectedProducts([])}
                        className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition font-medium text-sm"
                    >
                        Clear All
                    </button>
                    <button
                        onClick={saveFeaturedProducts}
                        disabled={saving}
                        className="ml-auto px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm flex items-center gap-2 disabled:opacity-50"
                    >
                        {saving ? (
                            <>
                                <Loader size={16} className="animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save size={16} />
                                Save Featured Products
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProducts.length === 0 ? (
                    <div className="col-span-full text-center py-12">
                        <p className="text-slate-500 text-lg">No products found</p>
                    </div>
                ) : (
                    filteredProducts.map(product => {
                        const isSelected = selectedProducts.includes(product._id)
                        const primaryImage = product.images?.[0] || 'https://ik.imagekit.io/jrstupuke/placeholder.png'

                        return (
                            <div
                                key={product._id}
                                onClick={() => toggleProduct(product._id)}
                                className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                                    isSelected
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-slate-200 bg-white hover:border-slate-300'
                                }`}
                            >
                                <div className="flex gap-4">
                                    {/* Checkbox */}
                                    <div className="flex-shrink-0 pt-1">
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => toggleProduct(product._id)}
                                            className="w-5 h-5 rounded cursor-pointer"
                                        />
                                    </div>

                                    {/* Product Info */}
                                    <div className="flex-1 min-w-0">
                                        {/* Image */}
                                        <div className="mb-3 bg-slate-50 rounded-lg overflow-hidden h-32">
                                            <Image
                                                src={primaryImage}
                                                alt={product.name}
                                                width={200}
                                                height={200}
                                                className="w-full h-full object-cover"
                                                onError={(e) => { e.currentTarget.src = 'https://ik.imagekit.io/jrstupuke/placeholder.png' }}
                                            />
                                        </div>

                                        {/* Name */}
                                        <h3 className="font-semibold text-slate-800 mb-1 line-clamp-2">
                                            {product.name}
                                        </h3>

                                        {/* SKU */}
                                        {product.sku && (
                                            <p className="text-xs text-slate-500 mb-2">SKU: {product.sku}</p>
                                        )}

                                        {/* Price */}
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="font-bold text-slate-800">
                                                AED{Number(product.price).toFixed(2)}
                                            </span>
                                            {product.AED > product.price && (
                                                <span className="text-xs text-slate-400 line-through">
                                                    AED{Number(product.AED).toFixed(2)}
                                                </span>
                                            )}
                                        </div>

                                        {/* Stock Status */}
                                        <span className={`text-xs px-2 py-1 rounded font-medium ${
                                            product.inStock
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-red-100 text-red-700'
                                        }`}>
                                            {product.inStock ? 'In Stock' : 'Out of Stock'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}
