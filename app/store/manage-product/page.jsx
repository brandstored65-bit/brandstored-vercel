
'use client'
import { useAuth } from '@/lib/useAuth';

export const dynamic = 'force-dynamic'
import { useEffect, useState } from "react"
import { useDispatch } from "react-redux"
import { fetchProducts as fetchProductsAction } from "@/lib/features/product/productSlice"
import { toast } from "react-hot-toast"
import Image from "next/image"
import Loading from "@/components/Loading"

import axios from "axios"
import ProductForm from "../add-product/page"



export default function StoreManageProducts() {
    const dispatch = useDispatch();

    const { user, getToken } = useAuth();

    const currency = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || 'AED'
    const formatAmount = (value) => {
        const numeric = Number(value)
        return Number.isFinite(numeric) ? numeric.toLocaleString() : '0'
    }

    // Safe Unicode text truncation that doesn't cut multi-byte characters
    const truncateText = (text, maxLength = 100) => {
        if (!text) return ''
        const cleaned = String(text).replace(/<[^>]*>/g, ' ').trim()
        // Safely truncate Unicode text - convert to array of graphemes
        const truncated = [...cleaned].slice(0, maxLength).join('')
        return cleaned.length > maxLength ? `${truncated}...` : truncated
    }

    const [loading, setLoading] = useState(true)
    const [products, setProducts] = useState([])
    const [editingProduct, setEditingProduct] = useState(null)
    const [showEditModal, setShowEditModal] = useState(false)
    const [categoryMap, setCategoryMap] = useState({}) // Map of category ID to name
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedCategory, setSelectedCategory] = useState('') // Category filter
    const [showFbtModal, setShowFbtModal] = useState(false)
    const [activeFbtProduct, setActiveFbtProduct] = useState(null)
    const [fbtLoading, setFbtLoading] = useState(false)
    const [fbtSaving, setFbtSaving] = useState(false)
    const [fbtEnabled, setFbtEnabled] = useState(false)
    const [fbtSelectedProducts, setFbtSelectedProducts] = useState([])
    const [fbtBundlePrice, setFbtBundlePrice] = useState('')
    const [fbtBundleDiscount, setFbtBundleDiscount] = useState('')
    const [fbtSearch, setFbtSearch] = useState('')
    const [fbtAvailableProducts, setFbtAvailableProducts] = useState([])

    const fetchStoreProducts = async () => {
        try {
             const token = await getToken()
             const { data } = await axios.get('/api/store/product', {headers: { Authorization: `Bearer ${token}` } })
             setProducts(data.products.sort((a, b)=> new Date(b.createdAt) - new Date(a.createdAt)))
        } catch (error) {
            toast.error(error?.response?.data?.error || error.message)
        }
        setLoading(false)
    }

    // Fetch all categories to map IDs to names
    const fetchCategories = async () => {
        try {
            const { data } = await axios.get('/api/store/categories')
            const map = {}
            data.categories?.forEach(cat => {
                map[cat._id] = cat.name
            })
            setCategoryMap(map)
        } catch (error) {
            console.error('Error fetching categories:', error)
        }
    }

    const toggleStock = async (productId) => {
        try {
            const token = await getToken()
            const { data } = await axios.post('/api/store/stock-toggle',{ productId }, {headers: { Authorization: `Bearer ${token}` } })
            setProducts(prevProducts => prevProducts.map(product =>  product._id === productId ? {...product, inStock: !product.inStock} : product))

            toast.success(data.message)
        } catch (error) {
            toast.error(error?.response?.data?.error || error.message)
        }
    }

    const toggleFastDelivery = async (productId) => {
        try {
            const token = await getToken()
            const { data } = await axios.post('/api/store/fast-delivery-toggle', { productId }, {headers: { Authorization: `Bearer ${token}` } })
            setProducts(prevProducts => prevProducts.map(product => 
                product._id === productId ? {...product, fastDelivery: !product.fastDelivery} : product
            ))
            toast.success(data.message)
        } catch (error) {
            toast.error(error?.response?.data?.error || error.message)
        }
    }

    const handleEdit = (product) => {
        console.log('Editing product:', product)
        console.log('  - product.category:', product.category)
        console.log('  - product.categories:', product.categories)
        console.log('  - categories is array?', Array.isArray(product.categories))
        setEditingProduct(product)
        setShowEditModal(true)
    }

    const handleDelete = async (productId) => {
        if (!confirm('Are you sure you want to delete this product?')) return
        
        try {
            const token = await getToken()
            await axios.delete(`/api/store/product?productId=${productId}`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            setProducts(prevProducts => prevProducts.filter(p => p._id !== productId))
            toast.success('Product deleted successfully')
        } catch (error) {
            toast.error(error?.response?.data?.error || error.message)
        }
    }

    const openFbtModal = async (product) => {
        try {
            setShowFbtModal(true)
            setActiveFbtProduct(product)
            setFbtLoading(true)
            setFbtSearch('')

            const [configRes, productsRes] = await Promise.all([
                axios.get(`/api/products/${product._id}/fbt`),
                axios.get('/api/products?limit=250')
            ])

            const config = configRes?.data || {}
            setFbtEnabled(!!config.enableFBT)
            setFbtBundlePrice(config.bundlePrice || '')
            setFbtBundleDiscount(config.bundleDiscount || '')
            setFbtSelectedProducts(Array.isArray(config.products) ? config.products : [])
            setFbtAvailableProducts(Array.isArray(productsRes?.data?.products) ? productsRes.data.products : [])
        } catch (error) {
            toast.error(error?.response?.data?.error || error.message || 'Failed to load FBT configuration')
        } finally {
            setFbtLoading(false)
        }
    }

    const toggleFbtProduct = (product) => {
        setFbtSelectedProducts((prev) => {
            const exists = prev.some((p) => String(p._id) === String(product._id))
            if (exists) {
                return prev.filter((p) => String(p._id) !== String(product._id))
            }
            if (prev.length >= 6) {
                toast.error('Maximum 6 products can be selected')
                return prev
            }
            return [...prev, product]
        })
    }

    const saveFbtConfig = async () => {
        if (!activeFbtProduct?._id) return
        if (fbtEnabled && fbtSelectedProducts.length === 0) {
            toast.error('Please select at least one related product')
            return
        }

        if (fbtBundlePrice !== '' && Number(fbtBundlePrice) < 0) {
            toast.error('Bundle price cannot be negative')
            return
        }

        if (fbtBundleDiscount !== '' && (Number(fbtBundleDiscount) < 0 || Number(fbtBundleDiscount) > 50)) {
            toast.error('Discount must be between 0 and 50')
            return
        }

        try {
            setFbtSaving(true)
            await axios.patch(`/api/products/${activeFbtProduct._id}/fbt`, {
                enableFBT: fbtEnabled,
                fbtProductIds: fbtEnabled ? fbtSelectedProducts.map((p) => p._id) : [],
                fbtBundlePrice: fbtEnabled && fbtBundlePrice !== '' ? Number(fbtBundlePrice) : null,
                fbtBundleDiscount: fbtEnabled && fbtBundleDiscount !== '' ? Number(fbtBundleDiscount) : null,
            })

            setProducts((prev) => prev.map((p) => (
                String(p._id) === String(activeFbtProduct._id)
                    ? { ...p, enableFBT: fbtEnabled }
                    : p
            )))

            toast.success('FBT configuration saved')
            setShowFbtModal(false)
            setActiveFbtProduct(null)
        } catch (error) {
            toast.error(error?.response?.data?.error || error.message || 'Failed to save FBT')
        } finally {
            setFbtSaving(false)
        }
    }

    const handleUpdateSuccess = (updatedProduct) => {
        setProducts(prevProducts => prevProducts.map(p => 
            p._id === updatedProduct._id ? updatedProduct : p
        ))
        setShowEditModal(false)
        setEditingProduct(null)
        // Refresh global Redux product list so frontend always uses latest slug
        dispatch(fetchProductsAction({}));
    }

    useEffect(() => {
        if(user){
            fetchStoreProducts()
            fetchCategories()
        }  
    }, [user])

    if (loading) return <Loading />

    // Filter products based on search query and selected category
    const filteredProducts = products.filter(product => {
        // Filter by selected category
        if (selectedCategory) {
            const hasCategory = product.categories?.includes(selectedCategory) || product.category === selectedCategory;
            if (!hasCategory) return false;
        }

        // Filter by search query
        if (!searchQuery) return true;
        
        const query = searchQuery.toLowerCase().trim();
        // Escape special regex characters and create word boundary regex
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const wordBoundaryRegex = new RegExp(`\\b${escapedQuery}\\b`, 'i');
        
        // Search in product name
        if (wordBoundaryRegex.test(product.name?.toLowerCase() || '')) return true;
        
        // Search in SKU
        if (wordBoundaryRegex.test(product.sku?.toLowerCase() || '')) return true;
        
        // Search in categories
        if (product.categories?.some(catId => wordBoundaryRegex.test(categoryMap[catId]?.toLowerCase() || ''))) return true;
        if (product.category && wordBoundaryRegex.test(categoryMap[product.category]?.toLowerCase() || '')) return true;
        
        // Search in tags
        if (product.tags?.some(tag => wordBoundaryRegex.test(tag.toLowerCase() || ''))) return true;
        
        // Search in description
        if (wordBoundaryRegex.test(product.description?.toLowerCase() || '')) return true;
        
        return false;
    });

    return (
        <>
            <h1 className="text-2xl text-slate-500 mb-5">Manage <span className="text-slate-800 font-medium">Products</span></h1>
            
            {/* Search Bar and Category Filter */}
            <div className="mb-6 max-w-5xl flex gap-4 flex-wrap">
                <div className="flex-1 min-w-xs">
                    <input
                        type="text"
                        placeholder="Search products by name, SKU, category, tags, or description..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {searchQuery && (
                        <p className="text-sm text-slate-600 mt-2">
                            Found {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}
                        </p>
                    )}
                </div>
                
                {/* Category Filter */}
                <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                    <option value="">All Categories</option>
                    {Object.entries(categoryMap).map(([id, name]) => (
                        <option key={id} value={id}>{name}</option>
                    ))}
                </select>
            </div>

            {/* Quick Category Filter Buttons */}
            <div className="mb-6 max-w-5xl">
                <p className="text-sm text-gray-600 font-medium mb-3">Quick Filter by Category:</p>
                <div className="flex flex-wrap gap-2 mb-3">
                    {['Trending & Featured', "Men's Fashion", "Women's Fashion", 'Kids', 'Electronics', 'Mobile Accessories', 'Home & Kitchen', 'Beauty', 'Car Essentials'].map((categoryName) => {
                        const categoryId = Object.entries(categoryMap).find(([_, name]) => name === categoryName)?.[0];
                        const isSelected = selectedCategory === categoryId;
                        return (
                            <button
                                key={categoryName}
                                onClick={() => setSelectedCategory(isSelected ? '' : (categoryId || ''))}
                                className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                                    isSelected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                                }`}
                            >
                                {categoryName}
                            </button>
                        );
                    })}
                </div>
                
                {/* Selected Category Pills */}
                {selectedCategory && (
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(categoryMap)
                            .filter(([id]) => id === selectedCategory)
                            .map(([id, name]) => (
                                <div
                                    key={id}
                                    className="inline-flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-full text-sm font-medium"
                                >
                                    {name}
                                    <button
                                        onClick={() => setSelectedCategory('')}
                                        className="ml-1 hover:opacity-70 transition"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                    </div>
                )}
            </div>

            <table className="w-full max-w-5xl text-left  ring ring-slate-200  rounded overflow-hidden text-sm">
                <thead className="bg-slate-50 text-gray-700 uppercase tracking-wider">
                    <tr>
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3 hidden lg:table-cell">SKU</th>
                        <th className="px-4 py-3 hidden md:table-cell">Categories</th>
                        <th className="px-4 py-3 hidden xl:table-cell">Tags</th>
                        <th className="px-4 py-3 hidden md:table-cell">Description</th>
                        <th className="px-4 py-3 hidden md:table-cell">AED</th>
                        <th className="px-4 py-3">Price</th>
                        <th className="px-4 py-3 hidden sm:table-cell">Fast Delivery</th>
                        <th className="px-4 py-3 hidden sm:table-cell">Frequently</th>
                        <th className="px-4 py-3">Stock</th>
                        <th className="px-4 py-3">Actions</th>
                    </tr>
                </thead>
                <tbody className="text-slate-700">
                    {filteredProducts.map((product) => (
                        <tr key={product._id} className="border-t border-gray-200 hover:bg-gray-50">
                            <td className="px-4 py-3">
                                <div className="flex gap-2 items-center max-w-xs">
                                    <Image width={40} height={40} className='p-1 shadow rounded cursor-pointer flex-shrink-0' src={product.images[0]} alt="" />
                                    <span className="break-words line-clamp-2 text-sm font-medium" title={product.name}>{product.name}</span>
                                </div>
                            </td>
                            <td className="px-4 py-3 text-slate-600 hidden lg:table-cell">{product.sku || '-'}</td>
                            <td className="px-4 py-3 hidden md:table-cell">
                                {product.categories && product.categories.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                        {product.categories.map((catId, idx) => (
                                            <span key={idx} className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                                                {categoryMap[catId] || catId}
                                            </span>
                                        ))}
                                    </div>
                                ) : product.category ? (
                                    <span className="inline-block px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">
                                        {categoryMap[product.category] || product.category}
                                    </span>
                                ) : (
                                    <span className="text-slate-400">-</span>
                                )}
                            </td>
                            <td className="px-4 py-3 hidden xl:table-cell">
                                {product.tags && product.tags.length > 0 ? (
                                    <div className="flex flex-wrap gap-1 max-w-xs">
                                        {product.tags.map((tag, idx) => (
                                            <span key={idx} className="inline-block px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <span className="text-slate-400">-</span>
                                )}
                            </td>
                            <td className="px-4 py-3 max-w-xs text-slate-600 hidden md:table-cell break-words" title={product.description?.replace(/<[^>]*>/g, ' ').trim() || '-'}>
                                {truncateText(product.description, 100)}
                            </td>
                            <td className="px-4 py-3 hidden md:table-cell">{currency} {formatAmount(product.mrp ?? product.AED ?? product.price)}</td>
                            <td className="px-4 py-3">{currency} {formatAmount(product.price)}</td>
                            <td className="px-4 py-3 hidden sm:table-cell">
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        className="sr-only peer" 
                                        onChange={() => toast.promise(toggleFastDelivery(product._id), { loading: "Updating..." })} 
                                        checked={product.fastDelivery || false} 
                                    />
                                    <div className="w-9 h-5 bg-slate-300 rounded-full peer peer-checked:bg-blue-600 transition-colors duration-200"></div>
                                    <span className="dot absolute left-1 top-1 w-3 h-3 bg-white rounded-full transition-transform duration-200 ease-in-out peer-checked:translate-x-4"></span>
                                </label>
                            </td>
                            <td className="px-4 py-3 hidden sm:table-cell">
                                {product.enableFBT ? (
                                    <span className="inline-flex px-2 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-700 rounded-full">Enabled</span>
                                ) : (
                                    <span className="inline-flex px-2 py-0.5 text-xs font-semibold bg-slate-100 text-slate-600 rounded-full">Disabled</span>
                                )}
                            </td>
                            <td className="px-4 py-3">
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" onChange={() => toast.promise(toggleStock(product._id), { loading: "Updating..." })} checked={product.inStock} />
                                    <div className="w-9 h-5 bg-slate-300 rounded-full peer peer-checked:bg-green-600 transition-colors duration-200"></div>
                                    <span className="dot absolute left-1 top-1 w-3 h-3 bg-white rounded-full transition-transform duration-200 ease-in-out peer-checked:translate-x-4"></span>
                                </label>
                            </td>
                            <td className="px-4 py-3">
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => handleEdit(product)}
                                        className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition"
                                    >
                                        Edit
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(product._id)}
                                        className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition"
                                    >
                                        Delete
                                    </button>
                                    <button
                                        onClick={() => openFbtModal(product)}
                                        className="px-3 py-1 bg-emerald-600 text-white text-xs rounded hover:bg-emerald-700 transition"
                                    >
                                        FBT
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {showEditModal && (
                <ProductForm 
                    product={editingProduct}
                    onClose={() => {
                        setShowEditModal(false)
                        setEditingProduct(null)
                    }}
                    onSubmitSuccess={handleUpdateSuccess}
                />
            )}

            {showFbtModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden bg-white rounded-2xl shadow-2xl border border-slate-200">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">Frequently Bought Together</h3>
                                <p className="text-sm text-slate-500">Base product: {activeFbtProduct?.name}</p>
                            </div>
                            <button
                                onClick={() => {
                                    setShowFbtModal(false)
                                    setActiveFbtProduct(null)
                                }}
                                className="text-slate-500 hover:text-slate-700 text-sm"
                            >
                                Close
                            </button>
                        </div>

                        <div className="p-5 space-y-4 overflow-y-auto max-h-[calc(90vh-140px)]">
                            {fbtLoading ? (
                                <div className="py-10 text-center text-slate-500">Loading FBT config...</div>
                            ) : (
                                <>
                                    <div className="rounded-lg border border-slate-200 p-3 flex items-center justify-between">
                                        <span className="text-sm font-medium text-slate-700">Enable frequently bought together</span>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={fbtEnabled}
                                                onChange={(e) => setFbtEnabled(e.target.checked)}
                                            />
                                            <div className="w-10 h-6 bg-slate-300 rounded-full peer peer-checked:bg-emerald-600 transition-colors duration-200"></div>
                                            <span className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 ease-in-out peer-checked:translate-x-4"></span>
                                        </label>
                                    </div>

                                    <input
                                        type="text"
                                        value={fbtSearch}
                                        onChange={(e) => setFbtSearch(e.target.value)}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2"
                                        placeholder="Search products by name, SKU or tags..."
                                    />

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 mb-1">FBT Fixed Price</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={fbtBundlePrice}
                                                onChange={(e) => setFbtBundlePrice(e.target.value)}
                                                className="w-full border border-slate-300 rounded-lg px-3 py-2"
                                                placeholder="Leave empty for dynamic total"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 mb-1">FBT Discount (%)</label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={fbtBundleDiscount}
                                                onChange={(e) => setFbtBundleDiscount(e.target.value)}
                                                className="w-full border border-slate-300 rounded-lg px-3 py-2"
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>

                                    <div className="text-xs text-slate-500">Selected: {fbtSelectedProducts.length}</div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[360px] overflow-y-auto pr-1">
                                        {fbtAvailableProducts
                                            .filter((p) => String(p._id) !== String(activeFbtProduct?._id))
                                            .filter((p) => {
                                                if (!fbtSearch.trim()) return true
                                                const q = fbtSearch.trim().toLowerCase()
                                                return (
                                                    String(p.name || '').toLowerCase().includes(q) ||
                                                    String(p.sku || '').toLowerCase().includes(q) ||
                                                    (Array.isArray(p.tags) && p.tags.some((tag) => String(tag).toLowerCase().includes(q)))
                                                )
                                            })
                                            .map((p) => {
                                                const selected = fbtSelectedProducts.some((sp) => String(sp._id) === String(p._id))
                                                return (
                                                    <button
                                                        type="button"
                                                        key={p._id}
                                                        onClick={() => toggleFbtProduct(p)}
                                                        className={`text-left border rounded-lg p-2 flex gap-2 items-center transition ${selected ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:bg-slate-50'}`}
                                                    >
                                                        <Image
                                                            src={p.images?.[0] || assets.upload_area}
                                                            width={42}
                                                            height={42}
                                                            alt={p.name || 'Product'}
                                                            className="rounded border"
                                                        />
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-sm font-medium text-slate-800 line-clamp-1">{p.name}</p>
                                                            <p className="text-xs text-slate-500">{currency} {formatAmount(p.price)}</p>
                                                        </div>
                                                    </button>
                                                )
                                            })}
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2 bg-white">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowFbtModal(false)
                                    setActiveFbtProduct(null)
                                }}
                                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={saveFbtConfig}
                                disabled={fbtSaving || fbtLoading}
                                className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-60"
                            >
                                {fbtSaving ? 'Saving...' : 'Save FBT'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}