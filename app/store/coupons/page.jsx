'use client'

export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/useAuth'
import { PlusIcon, EditIcon, TrashIcon, TicketIcon, XIcon, PercentIcon, DollarSignIcon, PackageIcon, UserIcon, ClockIcon, ToggleLeftIcon, ToggleRightIcon } from 'lucide-react'


export default function StoreCouponsPage() {
    const { getToken } = useAuth();
    const [coupons, setCoupons] = useState([])
    const [products, setProducts] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingCoupon, setEditingCoupon] = useState(null)
    const [submitting, setSubmitting] = useState(false)
    
    const currency = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || 'AED'

    const [formData, setFormData] = useState({
        code: '',
        description: '',
        discount: '',
        discountType: 'percentage',
        minPrice: '',
        minProductCount: '',
        specificProducts: [],
        forNewUser: false,
        forMember: false,
        firstOrderOnly: false,
        oneTimePerUser: false,
        usageLimit: '',
        isPublic: true,
        expiresAt: ''
    })

    // Fetch coupons and products

    useEffect(() => {
        fetchCoupons();
        fetchProducts();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchCoupons = async () => {
        try {
            const token = await getToken();
            const res = await fetch('/api/store/coupon', {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            const data = await res.json();
            console.log('Fetched coupons:', data);
            if (data.coupons) {
                setCoupons(data.coupons);
            }
        } catch (error) {
            console.error('Error fetching coupons:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchProducts = async () => {
        try {
            const token = await getToken();
            const res = await fetch('/api/store/product', {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            const data = await res.json();
            if (data.products) {
                setProducts(data.products);
            }
        } catch (error) {
            console.error('Error fetching products:', error);
        }
    };

    // Handle form submit

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const url = editingCoupon
                ? `/api/store/coupon/${editingCoupon.code}`
                : '/api/store/coupon';

            const method = editingCoupon ? 'PUT' : 'POST';
            const token = await getToken();
            
            console.log('Submitting coupon:', { url, method, formData });
            
            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify(formData)
            });

            const data = await res.json();
            
            console.log('Response:', { status: res.status, data });

            if (res.ok) {
                alert(editingCoupon ? 'Coupon updated!' : 'Coupon created!');
                setShowModal(false);
                setEditingCoupon(null);
                resetForm();
                fetchCoupons();
            } else {
                console.error('Save failed:', data);
                alert(data.error || 'Failed to save coupon');
            }
        } catch (error) {
            console.error('Error saving coupon:', error);
            alert('Failed to save coupon: ' + error.message);
        } finally {
            setSubmitting(false);
        }
    };

    // Handle delete
    const handleDelete = async (code) => {
        if (!confirm('Are you sure you want to delete this coupon?')) return;

        try {
            const token = await getToken();
            const res = await fetch(`/api/store/coupon/${code}`, {
                method: 'DELETE',
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });

            const data = await res.json();

            if (res.ok) {
                alert('Coupon deleted!');
                fetchCoupons();
            } else {
                alert(data.error || 'Failed to delete coupon');
            }
        } catch (error) {
            console.error('Error deleting coupon:', error);
            alert('Failed to delete coupon');
        }
    };

    // Handle toggle active status
    const handleToggleActive = async (coupon) => {
        try {
            const token = await getToken();
            const res = await fetch(`/api/store/coupon/${coupon.code}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ isActive: !coupon.isActive })
            })

            if (res.ok) {
                fetchCoupons()
            } else {
                alert('Failed to update coupon status')
            }
        } catch (error) {
            console.error('Error toggling coupon:', error)
        }
    }

    // Handle edit
    const handleEdit = (coupon) => {
        setEditingCoupon(coupon)
        setFormData({
            code: coupon.code,
            description: coupon.description,
            discount: (coupon.discount || coupon.discountValue || '').toString(),
            discountType: coupon.discountType,
            minPrice: (coupon.minPrice || coupon.minOrderValue || '').toString(),
            minProductCount: coupon.minProductCount?.toString() || '',
            specificProducts: coupon.specificProducts || [],
            forNewUser: coupon.forNewUser || false,
            forMember: coupon.forMember || false,
            firstOrderOnly: coupon.firstOrderOnly || false,
            oneTimePerUser: coupon.oneTimePerUser || false,
            usageLimit: (coupon.usageLimit || coupon.maxUses || '').toString(),
            isPublic: coupon.isPublic !== undefined ? coupon.isPublic : true,
            expiresAt: coupon.expiresAt ? new Date(coupon.expiresAt).toISOString().slice(0, 16) : ''
        })
        setShowModal(true)
    }

    const resetForm = () => {
        setFormData({
            code: '',
            description: '',
            discount: '',
            discountType: 'percentage',
            minPrice: '',
            minProductCount: '',
            specificProducts: [],
            forNewUser: false,
            forMember: false,
            firstOrderOnly: false,
            oneTimePerUser: false,
            usageLimit: '',
            isPublic: true,
            expiresAt: ''
        })
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
            </div>
        )
    }

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Discount Coupons</h1>
                    <p className="text-gray-600 text-sm">Create and manage discount coupons for your store</p>
                </div>
                <button
                    onClick={() => {
                        setEditingCoupon(null)
                        resetForm()
                        setShowModal(true)
                    }}
                    className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors"
                >
                    <PlusIcon size={20} />
                    Create Coupon
                </button>
            </div>

            {/* Coupons List */}
            {coupons.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 rounded-lg">
                    <TicketIcon size={64} className="mx-auto text-gray-300 mb-4" />
                    <p className="text-xl text-gray-400 mb-2">No coupons yet</p>
                    <p className="text-gray-500">Create your first discount coupon to get started</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {coupons.map(coupon => (
                        <div
                            key={coupon.code}
                            className={`bg-white border-2 rounded-lg p-5 ${
                                coupon.isActive ? 'border-green-200' : 'border-gray-200 opacity-60'
                            }`}
                        >
                            {/* Header */}
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <TicketIcon size={20} className="text-orange-500" />
                                        <span className="font-bold text-lg text-gray-900">{coupon.code}</span>
                                    </div>
                                    <p className="text-sm text-gray-600 line-clamp-2">{coupon.description}</p>
                                </div>
                                <button
                                    onClick={() => handleToggleActive(coupon)}
                                    className="ml-2"
                                >
                                    {coupon.isActive ? (
                                        <ToggleRightIcon size={32} className="text-green-500" />
                                    ) : (
                                        <ToggleLeftIcon size={32} className="text-gray-400" />
                                    )}
                                </button>
                            </div>

                            {/* Discount Badge */}
                            <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg p-3 mb-3">
                                <div className="flex items-center justify-center gap-2">
                                    {coupon.discountType === 'percentage' ? (
                                        <PercentIcon size={24} />
                                    ) : (
                                        <span className="text-2xl font-bold">{currency}</span>
                                    )}
                                    <span className="text-3xl font-bold">{coupon.discount || coupon.discountValue || 0}</span>
                                    <span className="text-lg">OFF</span>
                                </div>
                            </div>

                            {/* Details */}
                            <div className="space-y-2 text-sm mb-4">
                                {(coupon.minPrice > 0 || coupon.minOrderValue > 0) && (
                                    <div className="flex items-center gap-2 text-gray-600">
                                        <DollarSignIcon size={16} />
                                        <span>Min: {currency}{coupon.minPrice || coupon.minOrderValue || 0}</span>
                                    </div>
                                )}
                                {coupon.minProductCount && (
                                    <div className="flex items-center gap-2 text-gray-600">
                                        <PackageIcon size={16} />
                                        <span>Min {coupon.minProductCount} products</span>
                                    </div>
                                )}
                                {(coupon.usageLimit || coupon.maxUses) && (
                                    <div className="flex items-center gap-2 text-gray-600">
                                        <UserIcon size={16} />
                                        <span>Used {coupon.usedCount || 0}/{coupon.usageLimit || coupon.maxUses}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-2 text-gray-600">
                                    <ClockIcon size={16} />
                                    <span>Expires: {new Date(coupon.expiresAt).toLocaleDateString()}</span>
                                </div>
                            </div>

                            {/* Tags */}
                            <div className="flex flex-wrap gap-1 mb-4">
                                {coupon.forNewUser && (
                                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">New User</span>
                                )}
                                {coupon.firstOrderOnly && (
                                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">First Order</span>
                                )}
                                {coupon.oneTimePerUser && (
                                    <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded">One Time</span>
                                )}
                                {coupon.specificProducts?.length > 0 && (
                                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">
                                        {coupon.specificProducts.length} Products
                                    </span>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 pt-3 border-t">
                                <button
                                    onClick={() => handleEdit(coupon)}
                                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                                >
                                    <EditIcon size={16} />
                                    Edit
                                </button>
                                <button
                                    onClick={() => handleDelete(coupon.code)}
                                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                                >
                                    <TrashIcon size={16} />
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-white rounded-lg w-full max-w-2xl my-8">
                        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center rounded-t-lg">
                            <h2 className="text-xl font-bold text-gray-900">
                                {editingCoupon ? 'Edit Coupon' : 'Create Coupon'}
                            </h2>
                            <button
                                onClick={() => {
                                    setShowModal(false)
                                    setEditingCoupon(null)
                                }}
                                className="p-1 hover:bg-gray-100 rounded"
                            >
                                <XIcon size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[calc(90vh-120px)] overflow-y-auto">
                            {/* Coupon Code */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Coupon Code *
                                </label>
                                <input
                                    type="text"
                                    value={formData.code}
                                    onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                                    required
                                    disabled={!!editingCoupon}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 uppercase"
                                    placeholder="SUMMER2024"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Description *
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                    required
                                    rows={2}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    placeholder="Get 20% off on all products"
                                />
                            </div>

                            {/* Discount Type and Amount */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Discount Type *
                                    </label>
                                    <select
                                        value={formData.discountType}
                                        onChange={(e) => setFormData(prev => ({ ...prev, discountType: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    >
                                        <option value="percentage">Percentage (%)</option>
                                        <option value="fixed">Fixed Amount ({currency})</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Discount Value *
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.discount}
                                        onChange={(e) => setFormData(prev => ({ ...prev, discount: e.target.value }))}
                                        required
                                        min="0"
                                        step="0.01"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        placeholder="20"
                                    />
                                </div>
                            </div>

                            {/* Min Price and Min Product Count */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Minimum Cart Value ({currency})
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.minPrice}
                                        onChange={(e) => setFormData(prev => ({ ...prev, minPrice: e.target.value }))}
                                        min="0"
                                        step="0.01"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        placeholder="0"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Minimum Product Count
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.minProductCount}
                                        onChange={(e) => setFormData(prev => ({ ...prev, minProductCount: e.target.value }))}
                                        min="0"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        placeholder="0"
                                    />
                                </div>
                            </div>

                            {/* Expiry Date and Usage Limit */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Expiry Date *
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={formData.expiresAt}
                                        onChange={(e) => setFormData(prev => ({ ...prev, expiresAt: e.target.value }))}
                                        required
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Usage Limit (Total)
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.usageLimit}
                                        onChange={(e) => setFormData(prev => ({ ...prev, usageLimit: e.target.value }))}
                                        min="0"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        placeholder="Unlimited"
                                    />
                                </div>
                            </div>

                            {/* Specific Products */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Specific Products (Optional)
                                </label>
                                <select
                                    multiple
                                    value={formData.specificProducts}
                                    onChange={(e) => {
                                        const selected = Array.from(e.target.selectedOptions, option => option.value)
                                        setFormData(prev => ({ ...prev, specificProducts: selected }))
                                    }}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 h-24"
                                >
                                    {products.map(product => (
                                        <option key={product.id} value={product.id}>
                                            {product.name}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-gray-500 mt-1">
                                    Hold Ctrl/Cmd to select multiple. Leave empty for all products.
                                </p>
                            </div>

                            {/* Checkboxes */}
                            <div className="space-y-2 border-t pt-4">
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={formData.forNewUser}
                                        onChange={(e) => setFormData(prev => ({ ...prev, forNewUser: e.target.checked }))}
                                        className="w-4 h-4 text-orange-500 rounded"
                                    />
                                    <span className="text-sm font-medium text-gray-700">For New Users Only</span>
                                </label>

                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={formData.firstOrderOnly}
                                        onChange={(e) => setFormData(prev => ({ ...prev, firstOrderOnly: e.target.checked }))}
                                        className="w-4 h-4 text-orange-500 rounded"
                                    />
                                    <span className="text-sm font-medium text-gray-700">First Order Only</span>
                                </label>

                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={formData.oneTimePerUser}
                                        onChange={(e) => setFormData(prev => ({ ...prev, oneTimePerUser: e.target.checked }))}
                                        className="w-4 h-4 text-orange-500 rounded"
                                    />
                                    <span className="text-sm font-medium text-gray-700">One Time Per User</span>
                                </label>

                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={formData.isPublic}
                                        onChange={(e) => setFormData(prev => ({ ...prev, isPublic: e.target.checked }))}
                                        className="w-4 h-4 text-orange-500 rounded"
                                    />
                                    <span className="text-sm font-medium text-gray-700">Public (Show to all customers)</span>
                                </label>
                            </div>

                            {/* Submit Buttons */}
                            <div className="flex gap-3 pt-4 sticky bottom-0 bg-white border-t -mx-6 px-6 py-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowModal(false)
                                        setEditingCoupon(null)
                                    }}
                                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {submitting ? 'Saving...' : editingCoupon ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
