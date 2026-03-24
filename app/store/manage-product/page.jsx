
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
        </>
    )
}