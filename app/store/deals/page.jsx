'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/useAuth'
import axios from 'axios'
import { toast } from 'react-hot-toast'
import { Plus, Edit, Trash2, Clock, Calendar, Loader, X, Check } from 'lucide-react'
import Image from 'next/image'

export default function DealsOfTheDay() {
    const { getToken } = useAuth()
    const [deals, setDeals] = useState([])
    const [products, setProducts] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingDeal, setEditingDeal] = useState(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [showSettingsBtn] = useState(true)

    // Form state
    const [formData, setFormData] = useState({
        title: '',
        productIds: [],
        startTime: '',
        endTime: '',
        priority: 0
    })

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        try {
            setLoading(true)
            const token = await getToken()
            
            // Fetch deals
            const { data: dealsData } = await axios.get('/api/store/deals?includeProducts=true', {
                headers: { Authorization: `Bearer ${token}` }
            })
            setDeals(dealsData.deals || [])

            // Fetch all products
            const { data: productsData } = await axios.get('/api/store/product', {
                headers: { Authorization: `Bearer ${token}` }
            })
            setProducts(productsData.products || [])
        } catch (error) {
            toast.error('Failed to load data')
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const openModal = (deal = null) => {
        if (deal) {
            setEditingDeal(deal)
            setFormData({
                title: deal.title,
                productIds: deal.productIds || [],
                startTime: new Date(deal.startTime).toISOString().slice(0, 16),
                endTime: new Date(deal.endTime).toISOString().slice(0, 16),
                priority: deal.priority || 0
            })
        } else {
            setEditingDeal(null)
            setFormData({
                title: '',
                productIds: [],
                startTime: '',
                endTime: '',
                priority: 0
            })
        }
        setShowModal(true)
    }

    const closeModal = () => {
        setShowModal(false)
        setEditingDeal(null)
        setFormData({
            title: '',
            productIds: [],
            startTime: '',
            endTime: '',
            priority: 0
        })
    }

    const toggleProduct = (productId) => {
        setFormData(prev => ({
            ...prev,
            productIds: prev.productIds.includes(productId)
                ? prev.productIds.filter(id => id !== productId)
                : [...prev.productIds, productId]
        }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        
        if (!formData.title || !formData.startTime || !formData.endTime) {
            toast.error('Please fill all required fields')
            return
        }

        if (formData.productIds.length === 0) {
            toast.error('Please select at least one product')
            return
        }

        try {
            const token = await getToken()
            
            if (editingDeal) {
                await axios.patch(`/api/store/deals/${editingDeal._id}`, formData, {
                    headers: { Authorization: `Bearer ${token}` }
                })
                toast.success('Deal updated successfully')
            } else {
                await axios.post('/api/store/deals', formData, {
                    headers: { Authorization: `Bearer ${token}` }
                })
                toast.success('Deal created successfully')
            }
            
            closeModal()
            fetchData()
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to save deal')
            console.error(error)
        }
    }

    const handleDelete = async (dealId) => {
        if (!confirm('Are you sure you want to delete this deal?')) return

        try {
            const token = await getToken()
            await axios.delete(`/api/store/deals/${dealId}`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            toast.success('Deal deleted successfully')
            fetchData()
        } catch (error) {
            toast.error('Failed to delete deal')
            console.error(error)
        }
    }

    const toggleDealStatus = async (deal) => {
        try {
            const token = await getToken()
            await axios.patch(`/api/store/deals/${deal._id}`, {
                isActive: !deal.isActive
            }, {
                headers: { Authorization: `Bearer ${token}` }
            })
            toast.success(`Deal ${deal.isActive ? 'deactivated' : 'activated'}`)
            fetchData()
        } catch (error) {
            toast.error('Failed to update deal status')
            console.error(error)
        }
    }

    const isActive = (deal) => {
        const now = new Date()
        const start = new Date(deal.startTime)
        const end = new Date(deal.endTime)
        return deal.isActive && now >= start && now <= end
    }

    const getStatus = (deal) => {
        const now = new Date()
        const start = new Date(deal.startTime)
        const end = new Date(deal.endTime)

        if (!deal.isActive) return { text: 'Inactive', color: 'bg-gray-500' }
        if (now < start) return { text: 'Scheduled', color: 'bg-blue-500' }
        if (now > end) return { text: 'Expired', color: 'bg-red-500' }
        return { text: 'Active', color: 'bg-green-500' }
    }

    const filteredProducts = products.filter(p =>
        p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader className="animate-spin" size={40} />
            </div>
        )
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Deals of the Day</h1>
                    <p className="text-slate-600 mt-2">Create time-based deals for your products</p>
                </div>
                <div className="flex gap-3">
                    <a
                        href="/store/storefront/deals"
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-medium"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Settings
                    </a>
                    <button
                        onClick={() => openModal()}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                    >
                        <Plus size={20} />
                        Create Deal
                    </button>
                </div>
            </div>

            {/* Deals List */}
            <div className="grid grid-cols-1 gap-6">
                {deals.length === 0 ? (
                    <div className="bg-white border rounded-lg p-12 text-center">
                        <Clock size={48} className="mx-auto text-slate-400 mb-4" />
                        <h3 className="text-xl font-semibold text-slate-700 mb-2">No deals yet</h3>
                        <p className="text-slate-500 mb-6">Create your first deal to showcase time-limited offers</p>
                        <button
                            onClick={() => openModal()}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                        >
                            Create Deal
                        </button>
                    </div>
                ) : (
                    deals.map((deal) => {
                        const status = getStatus(deal)
                        const active = isActive(deal)
                        
                        return (
                            <div key={deal._id} className="bg-white border rounded-lg overflow-hidden">
                                <div className="p-6">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <div className="flex items-center gap-3 mb-2">
                                                <h3 className="text-xl font-bold text-slate-800">{deal.title}</h3>
                                                <span className={`${status.color} text-white text-xs px-3 py-1 rounded-full font-medium`}>
                                                    {status.text}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-4 text-sm text-slate-600">
                                                <div className="flex items-center gap-2">
                                                    <Calendar size={16} />
                                                    <span>Start: {new Date(deal.startTime).toLocaleString()}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Clock size={16} />
                                                    <span>End: {new Date(deal.endTime).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => toggleDealStatus(deal)}
                                                className={`p-2 rounded-lg transition ${
                                                    deal.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                                                }`}
                                                title={deal.isActive ? 'Deactivate' : 'Activate'}
                                            >
                                                {deal.isActive ? <Check size={20} /> : <X size={20} />}
                                            </button>
                                            <button
                                                onClick={() => openModal(deal)}
                                                className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition"
                                            >
                                                <Edit size={20} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(deal._id)}
                                                className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition"
                                            >
                                                <Trash2 size={20} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Products */}
                                    <div className="mt-4">
                                        <p className="text-sm font-medium text-slate-700 mb-3">
                                            Products ({deal.products?.length || 0})
                                        </p>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                            {deal.products?.map((product) => (
                                                <div key={product._id} className="bg-slate-50 rounded-lg p-2 border">
                                                    <div className="aspect-square relative mb-2 rounded overflow-hidden bg-white">
                                                        {product.images?.[0] ? (
                                                            <Image
                                                                src={product.images[0]}
                                                                alt={product.name}
                                                                fill
                                                                className="object-cover"
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full bg-gray-200" />
                                                        )}
                                                    </div>
                                                    <p className="text-xs font-medium text-slate-700 truncate">
                                                        {product.name}
                                                    </p>
                                                    <p className="text-xs text-slate-500">AED{product.price}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="p-6 border-b flex justify-between items-center">
                            <h2 className="text-2xl font-bold text-slate-800">
                                {editingDeal ? 'Edit Deal' : 'Create New Deal'}
                            </h2>
                            <button
                                onClick={closeModal}
                                className="p-2 hover:bg-slate-100 rounded-lg transition"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
                            <div className="p-6 space-y-6">
                                {/* Title */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Deal Title *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="e.g., Morning Flash Sale"
                                        required
                                    />
                                </div>

                                {/* Time Range */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                            Start Time *
                                        </label>
                                        <input
                                            type="datetime-local"
                                            value={formData.startTime}
                                            onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                                            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                            End Time *
                                        </label>
                                        <input
                                            type="datetime-local"
                                            value={formData.endTime}
                                            onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                                            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Priority */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Priority (higher shows first)
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.priority}
                                        onChange={(e) => setFormData({ ...formData, priority: Number(e.target.value) })}
                                        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                {/* Product Selection */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Select Products ({formData.productIds.length} selected) *
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Search products..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                                    />
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-96 overflow-y-auto border rounded-lg p-4">
                                        {filteredProducts.map((product) => (
                                            <div
                                                key={product._id}
                                                onClick={() => toggleProduct(product._id)}
                                                className={`cursor-pointer rounded-lg p-3 border-2 transition ${
                                                    formData.productIds.includes(product._id)
                                                        ? 'border-blue-500 bg-blue-50'
                                                        : 'border-slate-200 hover:border-slate-300'
                                                }`}
                                            >
                                                <div className="aspect-square relative mb-2 rounded overflow-hidden bg-white">
                                                    {product.images?.[0] ? (
                                                        <Image
                                                            src={product.images[0]}
                                                            alt={product.name}
                                                            fill
                                                            className="object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full bg-gray-200" />
                                                    )}
                                                </div>
                                                <p className="text-xs font-medium text-slate-700 truncate">
                                                    {product.name}
                                                </p>
                                                <p className="text-xs text-slate-500">AED{product.price}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 border-t flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                                >
                                    {editingDeal ? 'Update Deal' : 'Create Deal'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
