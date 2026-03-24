'use client'
import { useAuth } from '@/lib/useAuth';
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import Loading from '@/components/Loading';
import { RefreshCw, Undo2, X, Image as ImageIcon, CheckCircle, XCircle, Package } from 'lucide-react';

export default function StoreReturnRequests() {
    const { getToken } = useAuth();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedReturn, setSelectedReturn] = useState(null);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [processingReturn, setProcessingReturn] = useState(null);

    const fetchOrders = async () => {
        try {
            const token = await getToken(true);
            if (!token) {
                toast.error('Authentication failed. Please sign in again.');
                setLoading(false);
                return;
            }
            const { data } = await axios.get('/api/store/orders', {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            const ordersWithReturns = (data.orders || []).filter(order => 
                order.returns && order.returns.length > 0
            );
            
            setOrders(ordersWithReturns);
        } catch (error) {
            console.error('Fetch orders error:', error);
            toast.error(error?.response?.data?.error || error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (orderId, returnIndex) => {
        try {
            setProcessingReturn({ orderId, returnIndex });
            const token = await getToken(true);
            await axios.post('/api/store/return-requests', {
                orderId,
                returnIndex,
                action: 'APPROVE'
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('Request approved!');
            fetchOrders();
            setShowModal(false);
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Failed to approve');
        } finally {
            setProcessingReturn(null);
        }
    };

    const handleReject = async () => {
        if (!rejectReason.trim()) {
            toast.error('Please provide a rejection reason');
            return;
        }
        try {
            const { orderId, returnIndex } = processingReturn;
            const token = await getToken(true);
            await axios.post('/api/store/return-requests', {
                orderId,
                returnIndex,
                action: 'REJECT',
                rejectionReason: rejectReason.trim()
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('Request rejected!');
            setShowRejectModal(false);
            setRejectReason('');
            setProcessingReturn(null);
            fetchOrders();
            setShowModal(false);
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Failed to reject');
        }
    };

    useEffect(() => {
        fetchOrders();
    }, []);

    if (loading) return <Loading />;

    const getStatusBadge = (status) => {
        const badges = {
            REQUESTED: 'bg-yellow-100 text-yellow-800',
            APPROVED: 'bg-green-100 text-green-800',
            REJECTED: 'bg-red-100 text-red-800',
            COMPLETED: 'bg-blue-100 text-blue-800'
        };
        return badges[status] || 'bg-gray-100 text-gray-700';
    };

    const allReturns = orders.flatMap(order => 
        order.returns.map((returnReq, idx) => ({
            ...returnReq,
            orderId: order._id,
            orderNumber: order.orderNumber || order._id.slice(-8),
            returnIndex: idx,
            customerName: order.userId?.name || order.shippingAddress?.name || 'Guest',
            customerEmail: order.userId?.email || order.shippingAddress?.email || 'N/A',
            orderTotal: order.total
        }))
    );

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                    <RefreshCw className="text-orange-600" size={32} />
                    Return & Replacement Requests
                </h1>
                <p className="text-gray-600 mt-2">Manage customer return and replacement requests</p>
            </div>

            {allReturns.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl shadow">
                    <Package size={64} className="mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-500 text-lg font-medium">No return/replacement requests yet</p>
                    <p className="text-gray-400 text-sm mt-2">Requests will appear here when customers submit them</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Order / Customer</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Type</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Reason</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Status</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Date</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {allReturns.map((ret, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <p className="font-bold text-gray-900">#{ret.orderNumber}</p>
                                        <p className="text-sm text-gray-700">{ret.customerName}</p>
                                        <p className="text-xs text-gray-500">{ret.customerEmail}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${
                                            ret.type === 'RETURN' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                                        }`}>
                                            {ret.type === 'RETURN' ? <Undo2 size={14} /> : <RefreshCw size={14} />}
                                            {ret.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm max-w-xs"><p className="line-clamp-2">{ret.reason}</p></td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${getStatusBadge(ret.status)}`}>
                                            {ret.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm">
                                        {new Date(ret.requestedAt).toLocaleDateString()}
                                        <p className="text-xs text-gray-400">{new Date(ret.requestedAt).toLocaleTimeString()}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <button
                                            onClick={() => {
                                                setSelectedReturn(ret);
                                                setSelectedOrder(orders.find(o => o._id === ret.orderId));
                                                setShowModal(true);
                                            }}
                                            className="text-blue-600 hover:text-blue-800 font-semibold text-sm hover:underline"
                                        >
                                            View Details
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {showModal && selectedReturn && (
                <div onClick={() => setShowModal(false)} className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-gradient-to-r from-orange-600 to-red-600 text-white p-6 rounded-t-2xl z-10">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="text-2xl font-bold mb-1">Return/Replacement Request</h2>
                                    <p className="text-orange-100 text-sm">Order #{selectedReturn.orderNumber}</p>
                                    <p className="text-orange-200 text-xs mt-1">Total: AED{selectedReturn.orderTotal}</p>
                                </div>
                                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-white/20 rounded-full">
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="bg-blue-50 rounded-xl p-5 border border-blue-200">
                                <h3 className="font-bold text-gray-900 mb-4">Customer Information</h3>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <p className="text-gray-600">Name</p>
                                        <p className="font-bold">{selectedReturn.customerName}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-600">Email</p>
                                        <p className="font-bold">{selectedReturn.customerEmail}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-orange-50 rounded-xl p-5 border border-orange-200">
                                <h3 className="font-bold text-gray-900 mb-4">Request Details</h3>
                                <div className="space-y-4 text-sm">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-gray-600 mb-1">Type</p>
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold ${
                                                selectedReturn.type === 'RETURN' ? 'bg-red-200 text-red-900' : 'bg-blue-200 text-blue-900'
                                            }`}>
                                                {selectedReturn.type === 'RETURN' ? <Undo2 size={14} /> : <RefreshCw size={14} />}
                                                {selectedReturn.type}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="text-gray-600 mb-1">Status</p>
                                            <span className={`px-3 py-1.5 rounded-full font-bold ${getStatusBadge(selectedReturn.status)}`}>
                                                {selectedReturn.status}
                                            </span>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-gray-600 mb-1">Reason</p>
                                        <p className="font-semibold bg-white rounded-lg p-3 border">{selectedReturn.reason}</p>
                                    </div>
                                    {selectedReturn.description && (
                                        <div>
                                            <p className="text-gray-600 mb-1">Description</p>
                                            <p className="bg-white rounded-lg p-3 border">{selectedReturn.description}</p>
                                        </div>
                                    )}
                                    {selectedReturn.rejectionReason && (
                                        <div className="bg-red-100 border-2 border-red-300 rounded-lg p-4">
                                            <p className="text-red-900 font-bold mb-1">Rejection Reason:</p>
                                            <p className="text-red-800">{selectedReturn.rejectionReason}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {selectedReturn.images && selectedReturn.images.length > 0 && (
                                <div>
                                    <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                                        <ImageIcon size={20} className="text-purple-600" />
                                        Uploaded Images ({selectedReturn.images.length})
                                    </h3>
                                    <div className="grid grid-cols-3 gap-4">
                                        {selectedReturn.images.map((img, i) => (
                                            <a key={i} href={img} target="_blank" rel="noopener noreferrer" className="group relative">
                                                <img src={img} alt={`Evidence ${i + 1}`} className="w-full h-40 object-cover rounded-xl border-2 border-gray-200 group-hover:border-purple-400 transition cursor-pointer" />
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selectedReturn.status === 'REQUESTED' && (
                                <div className="flex gap-3 pt-4 border-t-2">
                                    <button
                                        onClick={() => handleApprove(selectedReturn.orderId, selectedReturn.returnIndex)}
                                        disabled={processingReturn !== null}
                                        className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-4 rounded-xl hover:bg-green-700 font-bold text-lg shadow-lg disabled:opacity-50"
                                    >
                                        <CheckCircle size={24} />
                                        Approve
                                    </button>
                                    <button
                                        onClick={() => {
                                            setProcessingReturn({ orderId: selectedReturn.orderId, returnIndex: selectedReturn.returnIndex });
                                            setShowRejectModal(true);
                                        }}
                                        disabled={processingReturn !== null}
                                        className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white py-4 rounded-xl hover:bg-red-700 font-bold text-lg shadow-lg disabled:opacity-50"
                                    >
                                        <XCircle size={24} />
                                        Reject
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showRejectModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                                <XCircle className="text-red-600" size={24} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold">Reject Request</h3>
                                <p className="text-sm text-gray-500">Provide a reason</p>
                            </div>
                        </div>
                        <div className="mb-6">
                            <label className="block text-sm font-semibold text-gray-700 mb-3">
                                Rejection Reason <span className="text-red-600">*</span>
                            </label>
                            <textarea
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="Explain why..."
                                rows="5"
                                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 resize-none"
                            />
                            <p className="text-xs text-gray-500 mt-2">This will be visible to the customer</p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowRejectModal(false);
                                    setRejectReason('');
                                    setProcessingReturn(null);
                                }}
                                className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 font-semibold"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleReject}
                                disabled={!rejectReason.trim()}
                                className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 font-semibold shadow-lg disabled:opacity-50"
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
