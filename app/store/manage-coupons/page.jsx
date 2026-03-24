'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/useAuth';

export default function ManageCouponsPage() {
  const { getToken } = useAuth();
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    code: '',
    title: '',
    description: '',
    discountType: 'percentage',
    discountValue: '',
    minOrderValue: '',
    maxDiscount: '',
    maxUses: '',
    maxUsesPerUser: '1',
    expiresAt: '',
    badgeColor: 'green',
  });

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    try {
      const token = await getToken();
      const res = await fetch('/api/store/coupons', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.coupons) {
        setCoupons(data.coupons);
      }
    } catch (error) {
      console.error('Error fetching coupons:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const url = editingCoupon
        ? `/api/store/coupons/${editingCoupon._id}`
        : '/api/store/coupons';

      const method = editingCoupon ? 'PUT' : 'POST';
      const token = await getToken();
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          ...formData,
          discountValue: parseFloat(formData.discountValue),
          minOrderValue: parseFloat(formData.minOrderValue) || 0,
          maxDiscount: formData.maxDiscount
            ? parseFloat(formData.maxDiscount)
            : null,
          maxUses: formData.maxUses ? parseInt(formData.maxUses) : null,
          maxUsesPerUser: parseInt(formData.maxUsesPerUser) || 1,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        alert(editingCoupon ? 'Coupon updated!' : 'Coupon created!');
        setShowModal(false);
        setEditingCoupon(null);
        resetForm();
        fetchCoupons();
      } else {
        alert(data.error || 'Failed to save coupon');
      }
    } catch (error) {
      console.error('Error saving coupon:', error);
      alert('Failed to save coupon');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (couponId) => {
    if (!confirm('Are you sure you want to delete this coupon?')) return;

    try {
      const token = await getToken();
      const res = await fetch(`/api/store/coupons?id=${couponId}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (res.ok) {
        alert('Coupon deleted!');
        fetchCoupons();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete coupon');
      }
    } catch (error) {
      console.error('Error deleting coupon:', error);
      alert('Failed to delete coupon');
    }
  };

  const handleToggleActive = async (coupon) => {
    try {
      const token = await getToken();
      const res = await fetch(`/api/store/coupons/${coupon._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ isActive: !coupon.isActive }),
      });

      if (res.ok) {
        fetchCoupons();
      } else {
        alert('Failed to update coupon status');
      }
    } catch (error) {
      console.error('Error toggling coupon:', error);
    }
  };

  const handleEdit = (coupon) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      title: coupon.title,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue.toString(),
      minOrderValue: coupon.minOrderValue?.toString() || '',
      maxDiscount: coupon.maxDiscount?.toString() || '',
      maxUses: coupon.maxUses?.toString() || '',
      maxUsesPerUser: coupon.maxUsesPerUser?.toString() || '1',
      expiresAt: coupon.expiresAt
        ? new Date(coupon.expiresAt).toISOString().slice(0, 16)
        : '',
      badgeColor: coupon.badgeColor || 'green',
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      code: '',
      title: '',
      description: '',
      discountType: 'percentage',
      discountValue: '',
      minOrderValue: '',
      maxDiscount: '',
      maxUses: '',
      maxUsesPerUser: '1',
      expiresAt: '',
      badgeColor: 'green',
    });
  };

  const getBadgeColorClass = (color) => {
    const colors = {
      green: 'bg-green-100 text-green-700',
      orange: 'bg-orange-100 text-orange-700',
      purple: 'bg-purple-100 text-purple-700',
      blue: 'bg-blue-100 text-blue-700',
    };
    return colors[color] || colors.green;
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center">Loading coupons...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Manage Coupons</h1>
        <button
          onClick={() => {
            resetForm();
            setEditingCoupon(null);
            setShowModal(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold transition"
        >
          + Add Coupon
        </button>
      </div>

      {coupons.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600 mb-4">No coupons created yet</p>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold transition"
          >
            Create Your First Coupon
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {coupons.map((coupon) => (
            <div
              key={coupon._id}
              className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className={`${getBadgeColorClass(
                        coupon.badgeColor
                      )} font-bold text-sm px-3 py-1 rounded`}
                    >
                      {coupon.code}
                    </div>
                    <span className="font-semibold text-gray-900">
                      {coupon.title}
                    </span>
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        coupon.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {coupon.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    {coupon.description}
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">Discount:</span>{' '}
                      <span className="font-semibold">
                        {coupon.discountType === 'percentage'
                          ? `${coupon.discountValue}%`
                          : `AED${coupon.discountValue}`}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Min Order:</span>{' '}
                      <span className="font-semibold">
                        AED{coupon.minOrderValue || 0}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Used:</span>{' '}
                      <span className="font-semibold">
                        {coupon.usedCount || 0}
                        {coupon.maxUses ? `/${coupon.maxUses}` : ''}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Expires:</span>{' '}
                      <span className="font-semibold">
                        {coupon.expiresAt
                          ? new Date(coupon.expiresAt).toLocaleDateString()
                          : 'Never'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleToggleActive(coupon)}
                    className={`px-3 py-1 rounded text-sm font-semibold transition ${
                      coupon.isActive
                        ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        : 'bg-green-100 hover:bg-green-200 text-green-700'
                    }`}
                  >
                    {coupon.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => handleEdit(coupon)}
                    className="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-sm font-semibold transition"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(coupon._id)}
                    className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-sm font-semibold transition"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h3 className="text-xl font-bold text-gray-900">
                {editingCoupon ? 'Edit Coupon' : 'Create New Coupon'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Coupon Code */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Coupon Code *
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 uppercase"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value })
                    }
                    placeholder="SAVE10"
                  />
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Title *
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    placeholder="10% Off"
                  />
                </div>

                {/* Description */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Description *
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Get 10% off on orders above AED500"
                  />
                </div>

                {/* Discount Type */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Discount Type *
                  </label>
                  <select
                    required
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    value={formData.discountType}
                    onChange={(e) =>
                      setFormData({ ...formData, discountType: e.target.value })
                    }
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (AED)</option>
                  </select>
                </div>

                {/* Discount Value */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Discount Value *
                  </label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="0"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    value={formData.discountValue}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        discountValue: e.target.value,
                      })
                    }
                    placeholder={
                      formData.discountType === 'percentage' ? '10' : '50'
                    }
                  />
                </div>

                {/* Min Order Value */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Minimum Order Value (AED)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    value={formData.minOrderValue}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        minOrderValue: e.target.value,
                      })
                    }
                    placeholder="500"
                  />
                </div>

                {/* Max Discount (for percentage) */}
                {formData.discountType === 'percentage' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Max Discount Cap (AED)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                      value={formData.maxDiscount}
                      onChange={(e) =>
                        setFormData({ ...formData, maxDiscount: e.target.value })
                      }
                      placeholder="100"
                    />
                  </div>
                )}

                {/* Max Uses */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Total Usage Limit
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    value={formData.maxUses}
                    onChange={(e) =>
                      setFormData({ ...formData, maxUses: e.target.value })
                    }
                    placeholder="Unlimited"
                  />
                </div>

                {/* Max Uses Per User */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Per User Limit
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    value={formData.maxUsesPerUser}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        maxUsesPerUser: e.target.value,
                      })
                    }
                    placeholder="1"
                  />
                </div>

                {/* Expires At */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Expiry Date
                  </label>
                  <input
                    type="datetime-local"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    value={formData.expiresAt}
                    onChange={(e) =>
                      setFormData({ ...formData, expiresAt: e.target.value })
                    }
                  />
                </div>

                {/* Badge Color */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Badge Color
                  </label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    value={formData.badgeColor}
                    onChange={(e) =>
                      setFormData({ ...formData, badgeColor: e.target.value })
                    }
                  >
                    <option value="green">Green</option>
                    <option value="orange">Orange</option>
                    <option value="purple">Purple</option>
                    <option value="blue">Blue</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
                >
                  {submitting
                    ? 'Saving...'
                    : editingCoupon
                    ? 'Update Coupon'
                    : 'Create Coupon'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
