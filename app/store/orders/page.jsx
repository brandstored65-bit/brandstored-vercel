"use client";

// Update order status
const updateOrderStatus = async (orderId, newStatus, getToken, fetchOrders) => {
    try {
        const token = await getToken(true); // Force refresh token
        if (!token) {
            toast.error('Authentication failed. Please sign in again.');
            return;
        }
        await axios.post('/api/store/orders/update-status', {
            orderId,
            status: newStatus
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Order status updated!');
        fetchOrders();
    } catch (error) {
        console.error('Update status error:', error);
        toast.error(error?.response?.data?.error || 'Failed to update status');
    }
};
import { useAuth } from '@/lib/useAuth';
export const dynamic = 'force-dynamic'
import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import Loading from "@/components/Loading"

import axios from "axios"
import toast from "react-hot-toast"
import { Package, Truck, X, Download, Printer, RefreshCw, MapPin, Trash2 } from "lucide-react"
import { downloadInvoice, printInvoice } from "@/lib/generateInvoice"
import { downloadAwbBill } from "@/lib/generateAwbBill"
import { schedulePickup } from '@/lib/delhivery'
import { getDefaultTrackingUrl, mapTrackingStatusToOrderStatus } from '@/lib/trackingShared'

function getPreferredTrackingUrl(courier, trackingId, trackingUrl) {
    const courierName = String(courier || '').trim().toLowerCase();
    const currentUrl = String(trackingUrl || '').trim();
    const generatedUrl = getDefaultTrackingUrl(courier, trackingId);

    // Backward compatibility for old GeoHaul links that pointed to raw API endpoints.
    if (courierName.includes('geoh') || courierName.includes('geohaul')) {
        const isGeoHaulApiUrl = /\/api\/v2\/consignment\/track/i.test(currentUrl);
        if (!currentUrl || isGeoHaulApiUrl) {
            return generatedUrl || currentUrl;
        }
    }

    return currentUrl || generatedUrl;
}

// Add updateTrackingDetails function
// (must be inside the component, not top-level)
const updateTrackingDetails = async (orderId, trackingId, trackingUrl, courier, getToken, fetchOrders) => {
    try {
        const token = await getToken(true); // Force refresh token
        if (!token) {
            toast.error('Authentication failed. Please sign in again.');
            return;
        }
        await axios.post('/api/store/orders/update-tracking', {
            orderId,
            trackingId,
            trackingUrl,
            courier
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Tracking details updated!');
        fetchOrders();
    } catch (error) {
        console.error('Update tracking error:', error);
        toast.error(error?.response?.data?.error || 'Failed to update tracking details');
    }
};

export default function StoreOrders() {
    const currency = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || 'AED';
    const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [trackingData, setTrackingData] = useState({
        trackingId: '',
        trackingUrl: '',
        courier: ''
    });
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [datePreset, setDatePreset] = useState('ALL');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [exportTypeFilter, setExportTypeFilter] = useState('ALL');
    const [selectedOrderIds, setSelectedOrderIds] = useState([]);
    const [bulkStatus, setBulkStatus] = useState('');
    const [bulkActionLoading, setBulkActionLoading] = useState(false);
    const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
    const [schedulingPickup, setSchedulingPickup] = useState(false);
    const [sendingToDelhivery, setSendingToDelhivery] = useState(false);
    const [syncingGeoHaul, setSyncingGeoHaul] = useState(false);
    const [refreshingLiveTracking, setRefreshingLiveTracking] = useState(false);
    const [refreshInterval, setRefreshInterval] = useState(30); // seconds
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [rejectingReturnIndex, setRejectingReturnIndex] = useState(null);
    const [ltlPickupData, setLtlPickupData] = useState({
        client_warehouse: '',
        pickup_date: '',
        start_time: '',
        expected_package_count: 1
    });
    const [ltlLabelSize, setLtlLabelSize] = useState('std');
    const [awbManifestData, setAwbManifestData] = useState({
        pickup_location_name: '',
        payment_mode: 'cod',
        cod_amount: 0,
        weight: 1000,
        dimensions: [{ box_count: 1, length_cm: 10, width_cm: 10, height_cm: 10 }],
        dropoff_location: {}
    });
    const [generatingAwb, setGeneratingAwb] = useState(false);
    const refreshIntervalRef = useRef(null);
    const router = useRouter();

    const { user, getToken, loading: authLoading } = useAuth();

    // Status options available (aligned with customer dashboard and courier states)
    const STATUS_OPTIONS = [
        { value: 'ORDER_PLACED', label: 'Order Placed', color: 'bg-blue-100 text-blue-700' },
        { value: 'PROCESSING', label: 'Processing', color: 'bg-yellow-100 text-yellow-700' },
        { value: 'WAITING_FOR_PICKUP', label: 'Waiting For Pickup', color: 'bg-yellow-50 text-yellow-700' },
        { value: 'PICKUP_REQUESTED', label: 'Pickup Requested', color: 'bg-yellow-100 text-yellow-700' },
        { value: 'PICKED_UP', label: 'Picked Up', color: 'bg-purple-100 text-purple-700' },
        { value: 'WAREHOUSE_RECEIVED', label: 'Warehouse Received', color: 'bg-indigo-100 text-indigo-700' },
        { value: 'SHIPPED', label: 'Shipped / In Transit', color: 'bg-purple-100 text-purple-700' },
        { value: 'OUT_FOR_DELIVERY', label: 'Out For Delivery', color: 'bg-teal-100 text-teal-700' },
        { value: 'DELIVERED', label: 'Delivered', color: 'bg-green-100 text-green-700' },
        { value: 'CANCELLED', label: 'Cancelled', color: 'bg-red-100 text-red-700' },
        { value: 'PAYMENT_FAILED', label: 'Payment Failed', color: 'bg-orange-100 text-orange-700' },
        { value: 'RETURNED', label: 'Returned', color: 'bg-indigo-100 text-indigo-700' },
        { value: 'RETURN_INITIATED', label: 'Return Initiated', color: 'bg-pink-100 text-pink-700' },
        { value: 'RETURN_APPROVED', label: 'Return Approved', color: 'bg-pink-100 text-pink-700' },
    ];

    // Get status color
    const getStatusColor = (status) => {
        const statusOption = STATUS_OPTIONS.find(s => s.value === status);
        return statusOption?.color || 'bg-gray-100 text-gray-700';
    };

    // Unified payment-status resolver for dashboard
    const isOrderPaid = (order) => {
        const paymentMethod = String(order?.paymentMethod || '').trim().toLowerCase();
        const orderStatus = String(order?.status || '').trim().toUpperCase();
        const paymentStatus = String(order?.paymentStatus || '').trim().toLowerCase();
        const hasPaidFlag = !!order?.isPaid;

        // COD is paid only when delivered/collected
        if (paymentMethod === 'cod') {
            if (orderStatus === 'DELIVERED') return true;
            if (order?.delhivery?.payment?.is_cod_recovered) return true;
            return hasPaidFlag;
        }

        // Non-COD (card/online/prepaid) should appear paid unless explicitly failed/unpaid
        if (paymentMethod) {
            const explicitFailedStatuses = new Set(['failed', 'payment_failed', 'refunded', 'unpaid']);
            if (hasPaidFlag) return true;
            if (explicitFailedStatuses.has(paymentStatus)) return false;
            if (orderStatus === 'PAYMENT_FAILED') return false;
            if (paymentStatus === 'pending') return false;
            return false;
        }

        return hasPaidFlag;
    };

    // Calculate order statistics
    const getOrderStats = () => {
        const stats = {
            TOTAL: orders.length,
            ORDER_PLACED: orders.filter(o => o.status === 'ORDER_PLACED').length,
            PROCESSING: orders.filter(o => o.status === 'PROCESSING').length,
            SHIPPED: orders.filter(o => o.status === 'SHIPPED').length,
            DELIVERED: orders.filter(o => o.status === 'DELIVERED').length,
            CANCELLED: orders.filter(o => o.status === 'CANCELLED').length,
            PAYMENT_FAILED: orders.filter(o => o.status === 'PAYMENT_FAILED').length,
            RETURNED: orders.filter(o => o.status === 'RETURNED').length,
            RETURN_REQUESTED: orders.filter(o => o.returns && o.returns.some(r => r.status === 'REQUESTED')).length,
            PENDING_PAYMENT: orders.filter(o => {
                return !isOrderPaid(o);
            }).length,
            PENDING_SHIPMENT: orders.filter(o => !o.trackingId && ['ORDER_PLACED', 'PROCESSING'].includes(o.status)).length,
        };
        return stats;
    };

    const formatOrderDate = (value) => {
        if (!value) return 'N/A';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return 'N/A';
        return date.toLocaleDateString();
    };

    const formatOrderDateTime = (value) => {
        if (!value) return 'N/A';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return 'N/A';
        return date.toLocaleString([], {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
    };

    const formatDateTimeInputValue = (value, endOfMinute = false) => {
        const date = value ? new Date(value) : new Date();
        if (Number.isNaN(date.getTime())) return '';

        if (endOfMinute) {
            date.setSeconds(59, 999);
        } else {
            date.setSeconds(0, 0);
        }

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');

        return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    const getDateRange = () => {
        if (!fromDate && !toDate) return { start: null, end: null };
        const start = fromDate ? new Date(fromDate) : null;
        const end = toDate ? new Date(toDate) : null;
        return { start, end };
    };

    const isOrderInRange = (order) => {
        const { start, end } = getDateRange();
        if (!start && !end) return true;
        const createdAt = order?.createdAt ? new Date(order.createdAt) : null;
        if (!createdAt || Number.isNaN(createdAt.getTime())) return false;
        if (start && createdAt < start) return false;
        if (end && createdAt > end) return false;
        return true;
    };

    // Filter orders based on selected status + date range
    const getFilteredOrders = () => {
        const dateFiltered = orders.filter(isOrderInRange);
        if (filterStatus === 'ALL') return dateFiltered;
        if (filterStatus === 'PENDING_PAYMENT') return dateFiltered.filter(o => {
            return !isOrderPaid(o);
        });
        if (filterStatus === 'PENDING_SHIPMENT') return dateFiltered.filter(o => !o.trackingId && ['ORDER_PLACED', 'PROCESSING'].includes(o.status));
        if (filterStatus === 'RETURN_REQUESTED') return dateFiltered.filter(o => o.returns && o.returns.some(r => r.status === 'REQUESTED'));
        return dateFiltered.filter(o => o.status === filterStatus);
    };

    const stats = getOrderStats();
    const filteredOrders = getFilteredOrders();
    const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
    const pageStartIndex = (currentPage - 1) * pageSize;
    const paginatedOrders = filteredOrders.slice(pageStartIndex, pageStartIndex + pageSize);
    const visibleOrderIds = paginatedOrders.map((order) => order._id);
    const selectedVisibleCount = visibleOrderIds.filter((orderId) => selectedOrderIds.includes(orderId)).length;
    const allVisibleSelected = visibleOrderIds.length > 0 && selectedVisibleCount === visibleOrderIds.length;
    const hasSelectedOrders = selectedOrderIds.length > 0;

    useEffect(() => {
        setCurrentPage(1);
    }, [filterStatus, datePreset, fromDate, toDate, pageSize]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    const toggleOrderSelection = (orderId) => {
        setSelectedOrderIds((prev) => (
            prev.includes(orderId)
                ? prev.filter((id) => id !== orderId)
                : [...prev, orderId]
        ));
    };

    const toggleSelectAllVisible = () => {
        if (allVisibleSelected) {
            setSelectedOrderIds((prev) => prev.filter((id) => !visibleOrderIds.includes(id)));
            return;
        }

        setSelectedOrderIds((prev) => Array.from(new Set([...prev, ...visibleOrderIds])));
    };

    const clearSelectedOrders = () => {
        setSelectedOrderIds([]);
    };

    const runBulkAction = async (action, payload = {}) => {
        if (!selectedOrderIds.length) {
            toast.error('Select at least one order');
            return;
        }

        setBulkActionLoading(true);
        try {
            const token = await getToken(true);
            if (!token) {
                toast.error('Authentication failed. Please sign in again.');
                return;
            }

            const { data } = await axios.post('/api/store/orders/bulk', {
                action,
                orderIds: selectedOrderIds,
                ...payload,
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (action === 'update-status' && payload.status) {
                setBulkStatus('');
                if (selectedOrder && selectedOrderIds.includes(selectedOrder._id)) {
                    setSelectedOrder((prev) => prev ? { ...prev, status: payload.status } : prev);
                }
            }

            toast.success(data?.message || 'Bulk action completed');
            clearSelectedOrders();
            await fetchOrders();
        } catch (error) {
            console.error('Bulk action error:', error);
            toast.error(error?.response?.data?.error || 'Bulk action failed');
        } finally {
            setBulkActionLoading(false);
        }
    };

    const handleBulkStatusUpdate = async () => {
        if (!bulkStatus) {
            toast.error('Choose a status first');
            return;
        }

        await runBulkAction('update-status', { status: bulkStatus });
    };

    const handleBulkDelete = async () => {
        if (!selectedOrderIds.length) {
            toast.error('Select at least one order');
            return;
        }

        if (!window.confirm(`Delete ${selectedOrderIds.length} selected order(s)? This action cannot be undone.`)) {
            return;
        }

        const deletingSelectedModalOrder = selectedOrder && selectedOrderIds.includes(selectedOrder._id);
        await runBulkAction('delete');

        if (deletingSelectedModalOrder) {
            closeModal();
        }
    };

    // Function to update tracking details (AWB), auto-set status and notify customer
    const updateTrackingDetails = async () => {
        if (!selectedOrder) return;

        const awb = (trackingData.trackingId || '').trim();
        let courierName = (trackingData.courier || selectedOrder?.courier || '').trim();
        let trackingUrl = (trackingData.trackingUrl || '').trim();

        if (!awb) {
            toast.error('AWB / Tracking ID is required');
            return;
        }

        // If courier is not set, default to Tawseel so the tracking URL is always generated.
        if (!courierName) {
            courierName = 'Tawseel';
        }

        trackingUrl = getPreferredTrackingUrl(courierName, awb, trackingUrl);

        // Auto-move status forward when tracking is added
        // If the order is still ORDER_PLACED or PROCESSING, treat it as SHIPPED
        let nextStatus = selectedOrder.status;
        if (nextStatus === 'ORDER_PLACED' || nextStatus === 'PROCESSING') {
            nextStatus = 'SHIPPED';
        }
        
        try {
            const token = await getToken();
            await axios.put(`/api/store/orders/${selectedOrder._id}`, {
                status: nextStatus,
                trackingId: awb,
                trackingUrl,
                courier: courierName
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('Tracking details updated, status set to Shipped & customer notified!');

            // Refresh orders list
            await fetchOrders();

            // Update selectedOrder locally so UI + Delhivery auto-refresh work immediately
            setSelectedOrder(prev => prev ? {
                ...prev,
                status: nextStatus,
                trackingId: awb,
                courier: courierName,
                trackingUrl
            } : prev);

            // Trigger an immediate live refresh for supported couriers
            if (trackingUrl) {
                try {
                    await refreshTrackingData();
                } catch {
                    // ignore refresh errors here; UI will still have AWB saved
                }
            }
        } catch (error) {
            console.error('Failed to update tracking:', error);
            toast.error(error?.response?.data?.error || 'Failed to update tracking details');
        }
    };

    // Manually trigger automatic status sync from latest courier tracking
    const autoSyncStatusFromTracking = async (targetOrder) => {
        const order = targetOrder || selectedOrder;

        if (!order || !order.trackingId) {
            toast.error('Add a tracking ID first');
            return;
        }
        try {
            const token = await getToken();
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
            
            const { data } = await axios.get(`/api/track-order?awb=${order.trackingId}`, {
                headers: { Authorization: `Bearer ${token}` },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            if (!data.order || !data.order.delhivery) {
                toast.error('No live courier status found yet. Try again later.');
                return;
            }

            const currentStatus = data.order.status || order.status;
            const mappedStatus = mapTrackingStatusToOrderStatus(data.order.delhivery, currentStatus);

            if (!mappedStatus || mappedStatus === currentStatus) {
                toast.error('Status is already up to date with tracking.');
                return;
            }

            await axios.post('/api/store/orders/update-status', {
                orderId: order._id,
                status: mappedStatus
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Update local state so UI reflects the change immediately
            setSelectedOrder(prev => prev && prev._id === order._id ? { ...prev, status: mappedStatus } : prev);
            setOrders(prev => prev.map(o => o._id === order._id ? { ...o, status: mappedStatus } : o));

            toast.success(`Order status set to "${mappedStatus}" from tracking.`);
        } catch (error) {
            if (error.name === 'AbortError') {
                console.error('Auto status sync timeout after 10 seconds');
                toast.error('Request timeout. Delhivery API took too long. Please try again.');
            } else {
                console.error('Auto status sync failed:', error);
                toast.error(error?.response?.data?.error || 'Failed to auto-sync status from tracking');
            }
        }
    };
    // Move openModal and closeModal to top level
    const openModal = (order) => {
        console.log('[MODAL DEBUG] Opening order:', order);
        console.log('[MODAL DEBUG] Order shippingAddress:', order.shippingAddress);
        console.log('[MODAL DEBUG] Order userId type:', typeof order.userId);
        console.log('[MODAL DEBUG] Order userId value:', order.userId);
        console.log('[MODAL DEBUG] Order userId is object?:', typeof order.userId === 'object');
        if (typeof order.userId === 'object' && order.userId !== null) {
            console.log('[MODAL DEBUG] User name:', order.userId.name);
            console.log('[MODAL DEBUG] User email:', order.userId.email);
        }
        console.log('[MODAL DEBUG] Order addressId:', order.addressId);
        console.log('[MODAL DEBUG] Order isGuest:', order.isGuest);
        const preferredTrackingUrl = getPreferredTrackingUrl(order.courier, order.trackingId, order.trackingUrl);
        setSelectedOrder({
            ...order,
            trackingUrl: preferredTrackingUrl || order.trackingUrl || ''
        });
        // Pre-fill tracking data if it exists
        setTrackingData({
            trackingId: order.trackingId || '',
            trackingUrl: preferredTrackingUrl || '',
            courier: order.courier || ''
        });
        // Pre-fill AWB manifest data from order
        const isCod = order.payment_method === 'cod' || order.paymentMethod === 'cod';
        setAwbManifestData({
            pickup_location_name: '',
            payment_mode: isCod ? 'cod' : 'prepaid',
            cod_amount: isCod ? order.total : 0,
            weight: Math.max(1000, Math.ceil(order.total / 10)), // Estimate: 1kg min or 100g per AED1
            dimensions: [{ box_count: 1, length_cm: 30, width_cm: 20, height_cm: 15 }],
            dropoff_location: order.shippingAddress || {}
        });
        setIsModalOpen(true);

        if (order?.trackingId) {
            refreshTrackingData(order);
        }
    };

    // Check Razorpay payment settlement status
    const checkRazorpaySettlement = async (order) => {
        if (!order.razorpayPaymentId) {
            toast.error('This order does not have a Razorpay payment');
            return;
        }
        
        try {
            const token = await getToken();
            const { data } = await axios.get(`/api/store/orders/check-razorpay-settlement?orderId=${order._id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (data.success) {
                // Update order locally if it was updated
                if (data.updated) {
                    setSelectedOrder(prev => prev && prev._id === order._id ? {
                        ...prev,
                        isPaid: true,
                        paymentStatus: 'CAPTURED'
                    } : prev);
                    setOrders(prev => prev.map(o => 
                        o._id === order._id ? {
                            ...o,
                            isPaid: true,
                            paymentStatus: 'CAPTURED'
                        } : o
                    ));
                }
                
                const settlement = data.razorpayStatus;
                let message = `💳 Razorpay Payment Status\n`;
                message += `Amount: AED${settlement.amount}\n`;
                message += `Status: ${settlement.payment_captured ? '✓ Captured' : '✗ Not captured'}\n`;
                message += `Fee: AED${settlement.fee || 0}\n`;
                message += `Settlement: ${settlement.settlement_status}\n`;
                
                if (settlement.transfer_details) {
                    message += `✓ Transferred to Bank\n`;
                    message += `Transfer ID: ${settlement.transfer_details.transfer_id}\n`;
                    message += `Amount: AED${settlement.transfer_details.amount_transferred}`;
                } else {
                    message += `Pending transfer to bank account`;
                }
                
                toast.success(message);
            } else {
                toast.error(data.error);
            }
        } catch (error) {
            console.error('Razorpay check error:', error);
            toast.error(error?.response?.data?.error || 'Failed to check payment settlement');
        }
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedOrder(null);
        // Reset tracking data
        setTrackingData({
            trackingId: '',
            trackingUrl: '',
            courier: ''
        });
    };

    // Helper function to compute correct payment status
    const getPaymentStatus = (order) => {
        const paymentMethod = (order.paymentMethod || '').toLowerCase();
        const status = (order.status || '').toUpperCase();
        const resolvedPaid = isOrderPaid(order);
        
        console.log('[PAYMENT STATUS DEBUG]', {
            orderId: order._id,
            paymentMethod: order.paymentMethod,
            status: order.status,
            isPaid: order.isPaid,
            paymentStatus: order.paymentStatus,
            normalizedPaymentMethod: paymentMethod,
            normalizedStatus: status,
            resolvedPaid,
            delhiveryPaymentCollected: order.delhivery?.payment?.is_cod_recovered,
        });

        return resolvedPaid;
    };

    const fetchOrders = async () => {
        try {
            const token = await getToken();
            if (!token) {
                toast.error("Invalid session. Please sign in again.");
                setLoading(false);
                return;
            }
            const { data } = await axios.get('/api/store/orders', {headers: { Authorization: `Bearer ${token}` }});
            console.log('[ORDERS DEBUG] Raw orders data:', data.orders);
            
            // Debug first 3 orders
            if (data.orders && data.orders.length > 0) {
                console.log('[ORDERS DEBUG] First 3 orders payment/status info:');
                data.orders.slice(0, 3).forEach((o, i) => {
                    console.log(`Order ${i}:`, { _id: o._id, paymentMethod: o.paymentMethod, status: o.status, isPaid: o.isPaid });
                });
            }

            let syncedOrders = data.orders || [];

            // One-time client-side sync: if Delhivery says "out for delivery" / "delivered" etc.
            // but order.status is still ORDER_PLACED/PROCESSING/CANCELLED, bump status to match
            // and persist the change back to the backend so customer views stay in sync.
            const updatesToPersist = [];
            syncedOrders = syncedOrders.map(order => {
                const mapped = mapTrackingStatusToOrderStatus(order.delhivery, order.status);
                if (mapped && mapped !== order.status) {
                    updatesToPersist.push({ orderId: order._id, status: mapped });
                    return { ...order, status: mapped };
                }
                return order;
            });

            if (syncedOrders.length > 0) {
                console.log('[ORDERS DEBUG] First synced order sample:', JSON.stringify(syncedOrders[0], null, 2));
            }

            // Persist any mapped statuses silently (no toast spam)
            if (updatesToPersist.length > 0) {
                try {
                    await Promise.all(
                        updatesToPersist.map(update =>
                            axios.post('/api/store/orders/update-status', update, {
                                headers: { Authorization: `Bearer ${token}` }
                            })
                        )
                    );
                } catch (statusSyncError) {
                    console.error('Failed to persist auto-mapped statuses:', statusSyncError);
                }
            }

            setOrders(syncedOrders);
            setSelectedOrderIds((prev) => prev.filter((orderId) => syncedOrders.some((order) => order._id === orderId)));
            setSelectedOrder((prev) => {
                if (!prev) return prev;
                const refreshedOrder = syncedOrders.find((order) => order._id === prev._id);
                return refreshedOrder || prev;
            });
        } catch (error) {
            toast.error(error?.response?.data?.error || error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (authLoading) return; // Wait for auth to load
        if (!user) {
            toast.error("You must be signed in as a seller to view orders.");
            setLoading(false);
            return;
        }
        fetchOrders();
        // eslint-disable-next-line
    }, [authLoading, user]);

    // Auto-refresh tracking data
    useEffect(() => {
        if (autoRefreshEnabled && selectedOrder?.trackingId) {
            refreshIntervalRef.current = setInterval(() => {
                refreshTrackingData();
            }, refreshInterval * 1000);
        }
        return () => {
            if (refreshIntervalRef.current) {
                clearInterval(refreshIntervalRef.current);
            }
        };
    }, [autoRefreshEnabled, selectedOrder, refreshInterval]);

    useEffect(() => {
        const today = new Date();
        const todayStart = new Date(today);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(today);
        todayEnd.setHours(23, 59, 59, 999);

        if (datePreset === 'TODAY') {
            setFromDate(formatDateTimeInputValue(todayStart));
            setToDate(formatDateTimeInputValue(todayEnd, true));
            return;
        }
        if (datePreset === 'LAST_7_DAYS') {
            const lastWeek = new Date(todayStart);
            lastWeek.setDate(todayStart.getDate() - 6);
            setFromDate(formatDateTimeInputValue(lastWeek));
            setToDate(formatDateTimeInputValue(todayEnd, true));
            return;
        }
        if (datePreset === 'ALL') {
            setFromDate('');
            setToDate('');
        }
    }, [datePreset]);

    const refreshTrackingData = async (targetOrder) => {
        const orderToRefresh = targetOrder || selectedOrder;
        if (!orderToRefresh || !orderToRefresh.trackingId) return;

        setRefreshingLiveTracking(true);
        try {
            const token = await getToken();
            const { data } = await axios.get(`/api/track-order?awb=${orderToRefresh.trackingId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (data.order) {
                // Optionally sync internal order.status with live courier status
                const mappedStatus = mapTrackingStatusToOrderStatus(
                    data.order.delhivery,
                    orderToRefresh.status || data.order.status
                );

                if (mappedStatus && mappedStatus !== (orderToRefresh.status || data.order.status)) {
                    try {
                        // Persist new status silently (no toast spam during auto-refresh)
                        await axios.post('/api/store/orders/update-status', {
                            orderId: orderToRefresh._id,
                            status: mappedStatus
                        }, {
                            headers: { Authorization: `Bearer ${token}` }
                        });

                        data.order.status = mappedStatus;
                    } catch (statusError) {
                        console.error('Failed to sync status from live tracking:', statusError);
                    }
                }

                // Update the selected order with fresh tracking data
                setSelectedOrder(prev => ({
                    ...prev,
                    ...data.order,
                    delhivery: data.order.delhivery || prev.delhivery
                }));
                // Also update in orders list
                setOrders(prev => prev.map(o => o._id === orderToRefresh._id ? {...o, ...data.order} : o));
            }
        } catch (error) {
            console.error('Failed to refresh tracking:', error);
        } finally {
            setRefreshingLiveTracking(false);
        }
    };

    const toExcelSafeValue = (value) => {
        if (value === null || value === undefined) return '';
        return String(value).replace(/\t|\r|\n/g, ' ').trim();
    };

    const getCurrencyCode = () => {
        return 'AED';
    };

    const normalizeUaeMobile = (phoneCode, phone, fallbackPhone) => {
        const raw = [phoneCode, phone].filter(Boolean).join(' ').trim() || (fallbackPhone || '');
        if (!raw) return '';

        let digits = String(raw).replace(/\D/g, '');

        if (digits.startsWith('971')) digits = digits.slice(3);
        if (digits.startsWith('0')) digits = digits.slice(1);
        if (digits.length > 9) digits = digits.slice(-9);

        return digits;
    };

    const getProductShortDescription = (orderItems) => {
        if (!Array.isArray(orderItems) || orderItems.length === 0) return '';
        const first = orderItems[0] || {};
        const name =
            first?.productId?.name ||
            first?.productId?.title ||
            first?.product?.name ||
            first?.product?.title ||
            first?.name ||
            first?.productName ||
            first?.title ||
            '';
        if (!name) return '';

        const normalizedName = String(name)
            .replace(/\[[^\]]*\]|\([^)]*\)|\{[^}]*\}/g, ' ')
            .replace(/[_]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        const primarySegment = normalizedName
            .split(/\s[|/,:;-]\s|\|/)
            .map((segment) => segment.trim())
            .find(Boolean) || normalizedName;

        const shortName = primarySegment
            .split(/\s+/)
            .slice(0, 4)
            .join(' ')
            .trim();

        return shortName || normalizedName;
    };

    const getProductsNote = (orderItems) => {
        if (!Array.isArray(orderItems) || orderItems.length === 0) return '';
        return orderItems
            .map((item) => (
                item?.productId?.name ||
                item?.productId?.title ||
                item?.product?.name ||
                item?.product?.title ||
                item?.name ||
                item?.productName ||
                item?.title ||
                ''
            ))
            .filter(Boolean)
            .join(', ');
    };

    const getDestinationFlatValue = (shipping) => {
        return (
            shipping?.flat ||
            shipping?.flatNo ||
            shipping?.flatNumber ||
            shipping?.apartment ||
            shipping?.apartmentNumber ||
            shipping?.villa ||
            shipping?.villaNumber ||
            shipping?.landmark ||
            shipping?.street ||
            ''
        );
    };

    const formatDestinationCityForExport = (value) => {
        const normalizedValue = String(value || '').trim();
        if (!normalizedValue) return '';

        const normalizedKey = normalizedValue.toLowerCase().replace(/[^a-z]/g, '');
        const cityMap = {
            dubai: 'Dubai',
            abudhabi: 'AbuDhabi',
            abudabi: 'AbuDhabi',
            alain: 'Al Ain',
            ajman: 'Ajman',
            fujairah: 'Fujairah',
            rasalkhaimah: 'RAK',
            rak: 'RAK',
            sharjah: 'Sharjah',
            ummalquwain: 'Umm Al Quwain',
            ummalqaiwain: 'Umm Al Quwain',
            uaq: 'Umm Al Quwain',
        };

        return cityMap[normalizedKey] || normalizedValue;
    };

    const ORDER_EXPORT_COLUMNS = [
        { header: 'Customer', key: 'customer', width: 14, highlight: true },
        { header: 'Payment Type', key: 'paymentType', width: 14 },
        { header: 'Service Type', key: 'serviceType', width: 14 },
        { header: 'Courier Type', key: 'courierType', width: 14 },
        { header: 'Currency', key: 'currency', width: 12 },
        { header: 'Cod', key: 'cod', width: 12, highlight: true, alignment: 'right' },
        { header: 'Description', key: 'description', width: 24, highlight: true },
        { header: 'Shipper Name', key: 'shipperName', width: 18 },
        { header: 'Shipper Phone Number', key: 'shipperPhoneNumber', width: 18 },
        { header: 'Origin Country', key: 'originCountry', width: 18 },
        { header: 'Origin City', key: 'originCity', width: 14 },
        { header: 'Origin Address', key: 'originAddress', width: 18 },
        { header: 'Origin Flat Or Villa Number', key: 'originFlatOrVillaNumber', width: 18 },
        { header: 'Receiver Name', key: 'receiverName', width: 22, highlight: true },
        { header: 'Receiver Phone Number', key: 'receiverPhoneNumber', width: 20, highlight: true },
        { header: 'Destination Country', key: 'destinationCountry', width: 18 },
        { header: 'Destination City', key: 'destinationCity', width: 16, highlight: true },
        { header: 'Destination Address', key: 'destinationAddress', width: 26, highlight: true },
        { header: 'Destination Flat Or Villa Number', key: 'destinationFlatOrVillaNumber', width: 22, highlight: true },
        { header: 'Number Of Pieces', key: 'numberOfPieces', width: 14, alignment: 'center' },
        { header: 'Length', key: 'length', width: 10, alignment: 'center' },
        { header: 'Width', key: 'width', width: 10, alignment: 'center' },
        { header: 'Height', key: 'height', width: 10, alignment: 'center' },
        { header: 'Dimension', key: 'dimension', width: 12, alignment: 'center' },
        { header: 'Weight', key: 'weight', width: 10, alignment: 'center' },
        { header: 'Weight Unit', key: 'weightUnit', width: 12, alignment: 'center' },
        { header: 'Value', key: 'value', width: 12, highlight: true, alignment: 'right' },
        { header: 'Note', key: 'note', width: 24, highlight: true },
        { header: '', key: 'blank', width: 8 },
    ];

    const getExportCustomerReference = (order) => {
        if (order?.shortOrderNumber) return toExcelSafeValue(order.shortOrderNumber);
        if (order?.customerId) return toExcelSafeValue(order.customerId);
        if (order?._id) return toExcelSafeValue(String(order._id).slice(0, 8).toUpperCase());
        return '';
    };

    const getOrderExportRow = (order) => {
        const shipping = order?.shippingAddress || {};
        const orderItems = Array.isArray(order?.orderItems) ? order.orderItems : [];
        const paymentMethod = String(order?.paymentMethod || order?.payment_method || '').toUpperCase();
        const receiverPhone = normalizeUaeMobile(shipping?.phoneCode, shipping?.phone, order?.guestPhone);
        const orderedAmount = Number(order?.total || 0);
        const productTitle = getProductShortDescription(orderItems);
        const codAmount = paymentMethod === 'STRIPE' ? 0 : orderedAmount;

        return {
            customer: getExportCustomerReference(order),
            paymentType: paymentMethod || '',
            serviceType: 'UAE DOM',
            courierType: 'DOCUMENTS',
            currency: getCurrencyCode(),
            cod: codAmount,
            description: toExcelSafeValue(productTitle),
            shipperName: 'BRANDSTORED',
            shipperPhoneNumber: '505730119',
            originCountry: 'United Arab Emirates',
            originCity: 'Dubai',
            originAddress: 'Firj Murar',
            originFlatOrVillaNumber: 'DEIRA',
            receiverName: toExcelSafeValue(shipping?.name || order?.guestName || order?.customerName || order?.userId?.name || ''),
            receiverPhoneNumber: toExcelSafeValue(receiverPhone || order?.guestPhone || ''),
            destinationCountry: 'United Arab Emirates',
            destinationCity: toExcelSafeValue(
                formatDestinationCityForExport(shipping?.state || shipping?.city || '')
            ),
            destinationAddress: toExcelSafeValue(shipping?.street || ''),
            destinationFlatOrVillaNumber: toExcelSafeValue(getDestinationFlatValue(shipping)),
            numberOfPieces: 1,
            length: 10,
            width: 5,
            height: 3,
            dimension: 'CM',
            weight: 2.5,
            weightUnit: 'KG',
            value: orderedAmount,
            note: toExcelSafeValue(productTitle),
            blank: '',
        };
    };

    const getExportFilteredOrders = () => {
        const baseOrders = filteredOrders;

        if (exportTypeFilter === 'ALL') return baseOrders;
        if (exportTypeFilter === 'CANCELLED') {
            return baseOrders.filter((order) => String(order?.status || '').toUpperCase() === 'CANCELLED');
        }
        if (exportTypeFilter === 'PAID') {
            return baseOrders.filter((order) => isOrderPaid(order));
        }
        if (exportTypeFilter === 'COD') {
            return baseOrders.filter((order) => String(order?.paymentMethod || order?.payment_method || '').toLowerCase() === 'cod');
        }

        return baseOrders;
    };

    const exportOrdersToExcel = async () => {
        const exportOrders = getExportFilteredOrders();

        if (!exportOrders.length) {
            toast.error('No orders available to export');
            return;
        }

        try {
            const ExcelJS = await import('exceljs');
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Orders', {
                views: [{ state: 'frozen', ySplit: 1 }],
            });

            const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '111111' } };
            const highlightHeaderFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF200' } };
            const bodyFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF' } };
            const highlightBodyFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8B3' } };
            const border = {
                top: { style: 'thin', color: { argb: 'D0D0D0' } },
                left: { style: 'thin', color: { argb: 'D0D0D0' } },
                bottom: { style: 'thin', color: { argb: 'D0D0D0' } },
                right: { style: 'thin', color: { argb: 'D0D0D0' } },
            };

            worksheet.columns = ORDER_EXPORT_COLUMNS.map((column) => ({
                header: column.header,
                key: column.key,
                width: column.width,
            }));

            const headerRow = worksheet.getRow(1);
            headerRow.height = 22;

            ORDER_EXPORT_COLUMNS.forEach((column, index) => {
                const cell = headerRow.getCell(index + 1);
                cell.fill = column.highlight ? highlightHeaderFill : headerFill;
                cell.font = {
                    bold: true,
                    color: { argb: column.highlight ? '000000' : 'FFFFFF' },
                    size: 11,
                };
                cell.alignment = {
                    vertical: 'middle',
                    horizontal: column.alignment || 'left',
                };
                cell.border = border;
            });

            exportOrders.forEach((order) => {
                const row = worksheet.addRow(getOrderExportRow(order));
                row.height = 20;

                ORDER_EXPORT_COLUMNS.forEach((column, index) => {
                    const cell = row.getCell(index + 1);
                    cell.fill = column.highlight ? highlightBodyFill : bodyFill;
                    cell.border = border;
                    cell.alignment = {
                        vertical: 'middle',
                        horizontal: column.alignment || 'left',
                    };
                    if (['cod', 'value'].includes(column.key) && typeof cell.value === 'number') {
                        cell.numFmt = '0.000';
                    }
                    if (column.key === 'weight' && typeof cell.value === 'number') {
                        cell.numFmt = '0.0';
                    }
                });
            });

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([
                buffer instanceof ArrayBuffer ? buffer : buffer.buffer,
            ], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            });

            const downloadUrl = URL.createObjectURL(blob);
            const downloadLink = document.createElement('a');
            downloadLink.href = downloadUrl;

            const dateLabel = new Date().toISOString().slice(0, 10);
            downloadLink.download = `store-orders-${dateLabel}.xlsx`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            downloadLink.remove();
            URL.revokeObjectURL(downloadUrl);

            toast.success(`Exported ${exportOrders.length} order(s)`);
        } catch (error) {
            console.error('Excel export failed:', error);
            toast.error('Failed to export Excel file');
        }
    };

    const schedulePickupWithDelhivery = async () => {
        if (!selectedOrder) return;
        
        if (!selectedOrder.trackingId) {
            toast.error('Please add tracking ID first');
            return;
        }

        setSchedulingPickup(true);
        try {
            const token = await getToken();
            
            // Call backend to schedule pickup
            const { data } = await axios.post('/api/store/schedule-pickup', {
                orderId: selectedOrder._id,
                trackingId: selectedOrder.trackingId,
                courierName: selectedOrder.courier || 'Delhivery',
                shippingAddress: selectedOrder.shippingAddress,
                shipmentWeight: 1, // kg - can be configurable
                packageCount: selectedOrder.orderItems?.length || 1
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (data.success) {
                toast.success(`✅ Pickup scheduled! ID: ${data.pickupId}`);
                fetchOrders();
            } else {
                toast.error(data.error || 'Failed to schedule pickup');
            }
        } catch (error) {
            console.error('Pickup scheduling error:', error);
            toast.error(error?.response?.data?.error || 'Failed to schedule pickup with Delhivery');
        } finally {
            setSchedulingPickup(false);
        }
    };

    const sendOrderToDelhivery = async () => {
        if (!selectedOrder) return;

        // Validate order can be sent to Delhivery
        if (!selectedOrder.shippingAddress?.street || !selectedOrder.shippingAddress?.city) {
            toast.error('Complete shipping address is required to send order to Delhivery');
            return;
        }

        setSendingToDelhivery(true);
        try {
            const token = await getToken();
            
            // Call backend to send order to Delhivery
            const { data } = await axios.post('/api/store/send-to-delhivery', {
                orderId: selectedOrder._id
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (data.success) {
                toast.success('✅ Order sent to Delhivery! Waiting for AWB assignment...');
                fetchOrders();
                // Refresh selected order
                setSelectedOrder(prev => prev ? {...prev, sentToDelhivery: true, orderStatus: 'PENDING_ASSIGNMENT'} : null);
            } else {
                toast.error(data.error || 'Failed to send order to Delhivery');
            }
        } catch (error) {
            console.error('Send to Delhivery error:', error);
            toast.error(error?.response?.data?.error || 'Failed to send order to Delhivery');
        } finally {
            setSendingToDelhivery(false);
        }
    };

    const syncOrderWithGeoHaul = async (action) => {
        if (!selectedOrder) return;

        if (!selectedOrder.shippingAddress?.street || !selectedOrder.shippingAddress?.city || !selectedOrder.shippingAddress?.country) {
            toast.error('Complete shipping address is required for GeoHaul sync');
            return;
        }

        const normalizedAction = String(action || 'create').toLowerCase();
        const currentOrderStatus = String(selectedOrder?.status || '').toUpperCase();
        const nonEditableUpdateStatuses = new Set([
            'PICKED_UP',
            'WAREHOUSE_RECEIVED',
            'SHIPPED',
            'OUT_FOR_DELIVERY',
            'DELIVERED',
            'CANCELLED',
            'RETURNED'
        ]);

        if (normalizedAction === 'update' && nonEditableUpdateStatuses.has(currentOrderStatus)) {
            toast.error(`GeoHaul update is disabled when order status is ${currentOrderStatus.replace(/_/g, ' ')}.`);
            return;
        }

        if ((normalizedAction === 'update' || normalizedAction === 'cancel') && !(selectedOrder.trackingId || trackingData.trackingId)) {
            toast.error('AWB / Tracking ID is required for GeoHaul update/cancel');
            return;
        }

        const resolvedAwb = (selectedOrder.trackingId || trackingData.trackingId || '').trim();

        setSyncingGeoHaul(true);
        try {
            const token = await getToken();
            const response = await axios.post('/api/store/geoh-consignment', {
                orderId: selectedOrder._id,
                action: normalizedAction,
                awb: resolvedAwb || undefined,
            }, {
                headers: { Authorization: `Bearer ${token}` },
                validateStatus: () => true,
            });
            const { data, status } = response;

            if (status >= 400) {
                const providerError = String(data?.error || '').trim();
                const detailMessage = String(
                    data?.details?.response?.message ||
                    data?.details?.message ||
                    data?.details?.raw ||
                    ''
                ).trim();
                const resolvedMessage = detailMessage || providerError || 'Failed to sync with GeoHaul';

                if (providerError.includes('already cancelled')) {
                    toast.error(providerError);
                } else if (resolvedMessage.includes('result.toObject is not a function')) {
                    if (normalizedAction === 'update') {
                        toast.error('GeoHaul update rejected this AWB state. Try creating a new consignment AWB for this order.');
                    } else if (normalizedAction === 'cancel') {
                        toast.error('GeoHaul cancel rejected this AWB state. Please verify AWB status on courier portal.');
                    } else {
                        toast.error('GeoHaul rejected this request for the current AWB state.');
                    }
                } else {
                    toast.error(resolvedMessage);
                }
                return;
            }

            if (!data?.success) {
                toast.error(data?.error || 'GeoHaul sync failed');
                return;
            }

            const actionLabel = normalizedAction.charAt(0).toUpperCase() + normalizedAction.slice(1);
            toast.success(`${actionLabel} synced with GeoHaul`);

            if (data?.order) {
                setSelectedOrder(data.order);
                setTrackingData((prev) => ({
                    ...prev,
                    trackingId: data.order.trackingId || prev.trackingId,
                    trackingUrl: data.order.trackingUrl || prev.trackingUrl,
                    courier: data.order.courier || prev.courier,
                }));
            }

            fetchOrders();
        } catch (error) {
            console.error('GeoHaul sync error:', error);
            toast.error('Failed to sync with GeoHaul');
        } finally {
            setSyncingGeoHaul(false);
        }
    };


    if (authLoading || loading) return <Loading />;

    return (
        <>
            <h1 className="text-2xl text-slate-500 mb-6">Store <span className="text-slate-800 font-medium">Orders</span></h1>
            
            {/* Order Statistics Cards */}
            <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-2 lg:grid-cols-5 lg:gap-4">
                <div 
                    onClick={() => setFilterStatus('ALL')}
                    className={`cursor-pointer rounded-lg p-4 transition-all ${filterStatus === 'ALL' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border border-gray-200 text-slate-700'}`}
                >
                    <p className="text-xs opacity-75">Total Orders</p>
                    <p className="text-2xl font-bold">{stats.TOTAL}</p>
                </div>
                <div 
                    onClick={() => setFilterStatus('PENDING_PAYMENT')}
                    className={`cursor-pointer rounded-lg p-4 transition-all ${filterStatus === 'PENDING_PAYMENT' ? 'bg-orange-600 text-white shadow-lg' : 'bg-white border border-gray-200 text-slate-700'}`}
                >
                    <p className="text-xs opacity-75">Pending Payment</p>
                    <p className="text-2xl font-bold">{stats.PENDING_PAYMENT}</p>
                </div>
                <div 
                    onClick={() => setFilterStatus('PROCESSING')}
                    className={`cursor-pointer rounded-lg p-4 transition-all ${filterStatus === 'PROCESSING' ? 'bg-yellow-600 text-white shadow-lg' : 'bg-white border border-gray-200 text-slate-700'}`}
                >
                    <p className="text-xs opacity-75">Processing</p>
                    <p className="text-2xl font-bold">{stats.PROCESSING}</p>
                </div>
                <div 
                    onClick={() => setFilterStatus('SHIPPED')}
                    className={`cursor-pointer rounded-lg p-4 transition-all ${filterStatus === 'SHIPPED' ? 'bg-purple-600 text-white shadow-lg' : 'bg-white border border-gray-200 text-slate-700'}`}
                >
                    <p className="text-xs opacity-75">Shipped</p>
                    <p className="text-2xl font-bold">{stats.SHIPPED}</p>
                </div>
                <div 
                    onClick={() => setFilterStatus('DELIVERED')}
                    className={`col-span-2 cursor-pointer rounded-lg p-4 transition-all md:col-span-1 ${filterStatus === 'DELIVERED' ? 'bg-green-600 text-white shadow-lg' : 'bg-white border border-gray-200 text-slate-700'}`}
                >
                    <p className="text-xs opacity-75">Delivered</p>
                    <p className="text-2xl font-bold">{stats.DELIVERED}</p>
                </div>
            </div>

            {/* Status Filter Tabs */}
            <div className="mb-6 flex flex-wrap gap-2">
                {['ALL', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'PAYMENT_FAILED', 'RETURNED', 'RETURN_REQUESTED'].map(status => (
                    <button
                        key={status}
                        onClick={() => setFilterStatus(status)}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${
                            filterStatus === status
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'bg-gray-100 text-slate-700 hover:bg-gray-200'
                        }`}
                    >
                        <span>{status === 'ALL' ? 'All Orders' : status === 'PAYMENT_FAILED' ? 'Payment Failed' : status === 'RETURN_REQUESTED' ? 'Return Requested' : status.replace(/_/g, ' ')}</span>
                        {status === 'RETURN_REQUESTED' && stats.RETURN_REQUESTED > 0 && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                filterStatus === status ? 'bg-blue-800' : 'bg-red-500 text-white'
                            }`}>
                                {stats.RETURN_REQUESTED}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Date Range Filters */}
            <div className="mb-6 bg-white border border-gray-200 rounded-lg p-4 flex flex-col gap-4">
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setDatePreset('ALL')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition ${datePreset === 'ALL' ? 'bg-slate-900 text-white' : 'bg-gray-100 text-slate-700 hover:bg-gray-200'}`}
                    >
                        All Orders
                    </button>
                    <button
                        onClick={() => setDatePreset('TODAY')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition ${datePreset === 'TODAY' ? 'bg-slate-900 text-white' : 'bg-gray-100 text-slate-700 hover:bg-gray-200'}`}
                    >
                        Today
                    </button>
                    <button
                        onClick={() => setDatePreset('LAST_7_DAYS')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition ${datePreset === 'LAST_7_DAYS' ? 'bg-slate-900 text-white' : 'bg-gray-100 text-slate-700 hover:bg-gray-200'}`}
                    >
                        Last 7 Days
                    </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                        <label className="text-xs text-slate-500">From</label>
                        <input
                            type="datetime-local"
                            value={fromDate}
                            onChange={(e) => {
                                setFromDate(e.target.value);
                                setDatePreset('CUSTOM');
                            }}
                            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-slate-500">To</label>
                        <input
                            type="datetime-local"
                            value={toDate}
                            onChange={(e) => {
                                setToDate(e.target.value);
                                setDatePreset('CUSTOM');
                            }}
                            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-slate-500">Export Type</label>
                        <select
                            value={exportTypeFilter}
                            onChange={(e) => setExportTypeFilter(e.target.value)}
                            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                        >
                            <option value="ALL">All</option>
                            <option value="CANCELLED">Cancelled</option>
                            <option value="PAID">Paid</option>
                            <option value="COD">COD</option>
                        </select>
                    </div>
                    <div className="flex items-end">
                        <div className="w-full flex items-center justify-between gap-3">
                            <div className="text-xs text-slate-500">Select date and export option before downloading</div>
                            <button
                                onClick={exportOrdersToExcel}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-semibold transition"
                            >
                                <Download size={14} />
                                Export Excel
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mb-6 bg-white border border-gray-200 rounded-lg p-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <p className="text-sm font-semibold text-slate-800">Bulk actions</p>
                    <p className="text-xs text-slate-500">
                        {hasSelectedOrders
                            ? `${selectedOrderIds.length} order(s) selected`
                            : 'Select orders from the list to update status or delete in bulk'}
                    </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <select
                        value={bulkStatus}
                        onChange={(e) => setBulkStatus(e.target.value)}
                        disabled={!hasSelectedOrders || bulkActionLoading}
                        className="min-w-[220px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:bg-gray-100"
                    >
                        <option value="">Change selected orders to...</option>
                        {STATUS_OPTIONS.map((status) => (
                            <option key={status.value} value={status.value}>{status.label}</option>
                        ))}
                    </select>
                    <button
                        onClick={handleBulkStatusUpdate}
                        disabled={!hasSelectedOrders || !bulkStatus || bulkActionLoading}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                    >
                        {bulkActionLoading ? 'Processing...' : 'Update Status'}
                    </button>
                    <button
                        onClick={handleBulkDelete}
                        disabled={!hasSelectedOrders || bulkActionLoading}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
                    >
                        <Trash2 size={16} />
                        Delete Selected
                    </button>
                    {hasSelectedOrders && (
                        <button
                            onClick={clearSelectedOrders}
                            disabled={bulkActionLoading}
                            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100"
                        >
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {filteredOrders.length === 0 ? (
                <p className="text-center py-8 text-slate-500">No orders found for this status</p>
            ) : (
                <>
                <div className="grid gap-4 md:hidden">
                    {paginatedOrders.map((order, index) => (
                        <div
                            key={order._id}
                            className={`rounded-xl border p-4 shadow-sm transition-colors ${selectedOrderIds.includes(order._id) ? 'border-blue-200 bg-blue-50/60' : 'border-gray-200 bg-white'}`}
                            onClick={() => openModal(order)}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Order</p>
                                    <p className="font-mono text-sm font-semibold text-slate-800">{order.shortOrderNumber || order._id.slice(0, 8)}</p>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={selectedOrderIds.includes(order._id)}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={() => toggleOrderSelection(order._id)}
                                    aria-label={`Select order ${order.shortOrderNumber || order._id.slice(0, 8)}`}
                                    className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                                <div className="col-span-2">
                                    <p className="text-xs text-slate-500">Customer</p>
                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                        <span className="font-medium text-slate-800">
                                            {order.isGuest 
                                                ? (order.guestName || order.customerName || 'Guest User')
                                                : (order.customerName || order.shippingAddress?.name || order.userId?.name || order.userId?.email || 'Unknown')}
                                        </span>
                                        {order.isGuest && (
                                            <span className="w-fit rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">
                                                Guest
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <p className="text-xs text-slate-500">Total</p>
                                    <p className="mt-1 font-semibold text-slate-900">{currency}{order.total}</p>
                                </div>

                                <div>
                                    <p className="text-xs text-slate-500">Payment</p>
                                    <span className={`mt-1 inline-flex rounded-full px-2 py-1 text-xs font-medium ${getPaymentStatus(order) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        {getPaymentStatus(order) ? 'Paid' : 'Pending'}
                                    </span>
                                </div>

                                <div className="col-span-2">
                                    <p className="text-xs text-slate-500">Order Time</p>
                                    <p className="mt-1 text-sm font-medium text-slate-800">{formatOrderDateTime(order.createdAt)}</p>
                                </div>

                                <div className="col-span-2" onClick={(e) => e.stopPropagation()}>
                                    <p className="text-xs text-slate-500">Status</p>
                                    <div className="mt-1 flex items-center gap-2">
                                        <select
                                            value={order.status}
                                            onChange={e => updateOrderStatus(order._id, e.target.value, getToken, fetchOrders)}
                                            className={`min-w-0 flex-1 rounded-md border-gray-300 px-2 py-2 text-sm font-medium focus:ring focus:ring-blue-200 ${getStatusColor(order.status)}`}
                                        >
                                            {STATUS_OPTIONS.map(status => (
                                                <option key={status.value} value={status.value}>{status.label}</option>
                                            ))}
                                        </select>
                                        {order.trackingId && (
                                            <button
                                                type="button"
                                                onClick={() => autoSyncStatusFromTracking(order)}
                                                className="rounded border border-slate-300 px-2 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                                                title="Auto-set status from latest tracking"
                                            >
                                                Auto
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="col-span-2">
                                    <p className="text-xs text-slate-500">Tracking</p>
                                    {order.trackingId ? (
                                        <span className="mt-1 inline-flex rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                                            {order.trackingId.substring(0, 8)}...
                                        </span>
                                    ) : (
                                        <span className="mt-1 inline-flex text-xs text-slate-400">Not shipped</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="hidden w-full overflow-x-auto rounded-md border border-gray-200 shadow md:block">
                    <table className="w-full text-sm text-left text-gray-600">
                        <thead className="bg-gray-50 text-gray-700 text-xs uppercase tracking-wider">
                            <tr>
                                <th className="px-4 py-3">
                                    <input
                                        type="checkbox"
                                        checked={allVisibleSelected}
                                        onChange={toggleSelectAllVisible}
                                        aria-label="Select all visible orders"
                                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                </th>
                                <th className="px-4 py-3">Sr. No.</th>
                                <th className="px-4 py-3">Order No.</th>
                                <th className="px-4 py-3">Customer</th>
                                <th className="px-4 py-3">Total</th>
                                <th className="px-4 py-3">Payment</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Tracking</th>
                                <th className="px-4 py-3">Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {paginatedOrders.map((order, index) => (
                                <tr
                                    key={order._id}
                                    className={`hover:bg-gray-50 transition-colors duration-150 cursor-pointer ${selectedOrderIds.includes(order._id) ? 'bg-blue-50/60' : ''}`}
                                    onClick={() => openModal(order)}
                                >
                                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            checked={selectedOrderIds.includes(order._id)}
                                            onChange={() => toggleOrderSelection(order._id)}
                                            aria-label={`Select order ${order.shortOrderNumber || order._id.slice(0, 8)}`}
                                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                    </td>
                                    <td className="pl-6 text-green-600 font-medium">{pageStartIndex + index + 1}</td>
                                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{order.shortOrderNumber || order._id.slice(0, 8)}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-col gap-1">
                                            <span className="font-medium text-slate-800">
                                                {order.isGuest 
                                                    ? (order.guestName || order.customerName || 'Guest User')
                                                    : (order.customerName || order.shippingAddress?.name || order.userId?.name || order.userId?.email || 'Unknown')}
                                            </span>
                                            {order.isGuest && (
                                                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full w-fit font-semibold">
                                                    Guest
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 font-medium text-slate-800">{currency}{order.total}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPaymentStatus(order) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {getPaymentStatus(order) ? '✓ Paid' : 'Pending'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3" onClick={e => { e.stopPropagation(); }}>
                                        <div className="flex items-center gap-2">
                                            <select
                                                value={order.status}
                                                onChange={e => updateOrderStatus(order._id, e.target.value, getToken, fetchOrders)}
                                                className={`border-gray-300 rounded-md text-sm font-medium px-2 py-1 focus:ring focus:ring-blue-200 ${getStatusColor(order.status)}`}
                                            >
                                                {STATUS_OPTIONS.map(status => (
                                                    <option key={status.value} value={status.value}>{status.label}</option>
                                                ))}
                                            </select>
                                            {order.trackingId && (
                                                <button
                                                    type="button"
                                                    onClick={() => autoSyncStatusFromTracking(order)}
                                                    className="text-xs font-semibold px-2 py-1 rounded border border-slate-300 text-slate-700 hover:bg-slate-100"
                                                    title="Auto-set status from latest tracking"
                                                >
                                                    Auto
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        {order.trackingId ? (
                                            <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full font-medium">
                                                {order.trackingId.substring(0, 8)}...
                                            </span>
                                        ) : (
                                            <span className="text-slate-400 text-xs">Not shipped</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-gray-500 text-xs">{formatOrderDateTime(order.createdAt)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="mt-4 flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-slate-600">
                        Showing <span className="font-semibold text-slate-900">{filteredOrders.length === 0 ? 0 : pageStartIndex + 1}</span>
                        {' '}-{' '}
                        <span className="font-semibold text-slate-900">{Math.min(pageStartIndex + paginatedOrders.length, filteredOrders.length)}</span>
                        {' '}of{' '}
                        <span className="font-semibold text-slate-900">{filteredOrders.length}</span>
                        {' '}orders
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <label className="flex items-center gap-2 text-sm text-slate-600">
                            <span>Per page</span>
                            <select
                                value={pageSize}
                                onChange={(event) => setPageSize(Number(event.target.value))}
                                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-slate-700"
                            >
                                {PAGE_SIZE_OPTIONS.map((option) => (
                                    <option key={option} value={option}>{option}</option>
                                ))}
                            </select>
                        </label>

                        <div className="flex items-center gap-2 self-start sm:self-auto">
                            <button
                                type="button"
                                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                                disabled={currentPage === 1}
                                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Previous
                            </button>
                            <span className="text-sm text-slate-600">
                                Page <span className="font-semibold text-slate-900">{currentPage}</span> of <span className="font-semibold text-slate-900">{totalPages}</span>
                            </span>
                            <button
                                type="button"
                                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                                disabled={currentPage === totalPages}
                                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>
                </>
            )}
            {isModalOpen && selectedOrder && (
                <div onClick={closeModal} className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm text-slate-700 text-sm z-50 p-4" >
                    <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                        {/* Header */}
                        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-2xl">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h2 className="text-2xl font-bold mb-1">Order Details</h2>
                                    <p className="text-blue-100 text-xs">Order ID: {String(selectedOrder._id).slice(0, 8).toUpperCase()} &nbsp;|&nbsp; Order No: <span className='font-mono text-white'>{selectedOrder.shortOrderNumber || selectedOrder._id.slice(0, 8)}</span></p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => downloadInvoice(selectedOrder)}
                                        className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors backdrop-blur-sm"
                                        title="Download Invoice"
                                    >
                                        <Download size={18} />
                                        <span className="text-sm">Download</span>
                                    </button>
                                    <button
                                        onClick={() => printInvoice(selectedOrder)}
                                        className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors backdrop-blur-sm"
                                        title="Print Invoice"
                                    >
                                        <Printer size={18} />
                                        <span className="text-sm">Print</span>
                                    </button>
                                    <button onClick={closeModal} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                                        <X size={24} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Tracking Details Section */}
                            <div className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-xl p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                                        <Truck size={20} className="text-white" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-orange-900">Tracking Information</h3>
                                </div>
                                
                                {selectedOrder.trackingId ? (
                                    <div className="bg-white rounded-lg p-4 mb-4">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            <div>
                                                <p className="text-xs text-slate-500 mb-1">Tracking ID</p>
                                                <p className="font-semibold text-slate-900">{selectedOrder.trackingId}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 mb-1">Courier</p>
                                                <p className="font-semibold text-slate-900">{selectedOrder.courier}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 mb-1">Track Order</p>
                                                {getPreferredTrackingUrl(selectedOrder.courier, selectedOrder.trackingId, selectedOrder.trackingUrl) ? (
                                                    <a href={getPreferredTrackingUrl(selectedOrder.courier, selectedOrder.trackingId, selectedOrder.trackingUrl)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">
                                                        View Tracking
                                                    </a>
                                                ) : (
                                                    <p className="text-slate-400">No URL</p>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => refreshTrackingData()}
                                                    disabled={refreshingLiveTracking || !selectedOrder?.trackingId}
                                                    className="mt-2 inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                                                >
                                                    {refreshingLiveTracking ? 'Refreshing...' : 'Refresh Live Tracking'}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Delhivery Live Status */}
                                        {selectedOrder.delhivery && (
                                            <div className="border-t border-slate-200 mt-4 pt-4">
                                                <p className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                                                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                                    📍 Live Delhivery Tracking
                                                </p>
                                                <div className="space-y-3">
                                                    {/* Current Location - Most Important */}
                                                    {selectedOrder.delhivery.current_status_location && (
                                                        <div className="bg-gradient-to-r from-green-500 to-emerald-500 p-4 rounded-lg text-white shadow-lg border-l-4 border-green-700">
                                                            <p className="text-xs font-semibold opacity-90">📍 Current Location</p>
                                                            <p className="font-bold text-lg mt-1">{selectedOrder.delhivery.current_status_location}</p>
                                                        </div>
                                                    )}

                                                    {/* Current Status */}
                                                    {selectedOrder.delhivery.current_status && (
                                                        <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                                                            <p className="text-xs text-slate-600 font-semibold">Status</p>
                                                            <p className="font-bold text-blue-700 mt-1 text-lg">{selectedOrder.delhivery.current_status}</p>
                                                        </div>
                                                    )}

                                                    {/* Expected Delivery */}
                                                    {selectedOrder.delhivery.expected_delivery_date && (
                                                        <div className="bg-purple-50 border border-purple-200 p-3 rounded-lg">
                                                            <p className="text-xs text-slate-600 font-semibold">Expected Delivery</p>
                                                            <p className="font-bold text-purple-700 mt-1">{new Date(selectedOrder.delhivery.expected_delivery_date).toLocaleDateString()} {new Date(selectedOrder.delhivery.expected_delivery_date).toLocaleTimeString()}</p>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Recent Events Timeline */}
                                                {selectedOrder.delhivery.events && selectedOrder.delhivery.events.length > 0 && (
                                                    <div className="border-t border-slate-200 mt-4 pt-4">
                                                        <p className="text-xs font-semibold text-slate-600 mb-3 flex items-center gap-2">
                                                            <span>📦</span> Tracking History
                                                        </p>
                                                        <div className="space-y-2 max-h-96 overflow-y-auto">
                                                            {selectedOrder.delhivery.events.map((event, idx) => (
                                                                <div key={idx} className="border-l-3 border-blue-400 pl-3 py-2 bg-slate-50 rounded-r p-2">
                                                                    <div className="flex justify-between items-start gap-2">
                                                                        <div className="flex-1">
                                                                            {event.location && (
                                                                                <div className="font-semibold text-slate-900 text-sm">📍 {event.location}</div>
                                                                            )}
                                                                            {event.status && (
                                                                                <div className="font-medium text-blue-700 text-sm mt-0.5">{event.status}</div>
                                                                            )}
                                                                            {event.remarks && (
                                                                                <div className="text-slate-600 text-xs mt-1 italic">{event.remarks}</div>
                                                                            )}
                                                                        </div>
                                                                        <div className="text-xs text-slate-500 whitespace-nowrap">
                                                                            {new Date(event.time).toLocaleString()}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ) : null}

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div>
                                        <label className="text-xs font-medium text-slate-700 block mb-1">AWB / Tracking ID *</label>
                                        <input
                                            type="text"
                                            value={trackingData.trackingId}
                                            onChange={e => setTrackingData({...trackingData, trackingId: e.target.value})}
                                            placeholder="Enter Delhivery AWB or courier tracking ID"
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-slate-700 block mb-1">Courier Name *</label>
                                        <input
                                            type="text"
                                            value={trackingData.courier}
                                            onChange={e => setTrackingData({...trackingData, courier: e.target.value})}
                                            placeholder="e.g., FedEx, DHL, UPS"
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-slate-700 block mb-1">Tracking URL</label>
                                        <input
                                            type="url"
                                            value={trackingData.trackingUrl}
                                            onChange={e => setTrackingData({...trackingData, trackingUrl: e.target.value})}
                                            placeholder="https://..."
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        />
                                    </div>
                                </div>
                                <button
                                    onClick={updateTrackingDetails}
                                    className="mt-3 w-full bg-orange-500 hover:bg-orange-600 text-white font-medium py-2.5 rounded-lg transition-colors"
                                >
                                    Update Tracking & Notify Customer
                                </button>

                                {/* Delhivery Pickup & Auto-Refresh Controls */}
                                {selectedOrder?.courier?.toLowerCase() === 'delhivery' && (
                                    <div className="mt-4 space-y-2">
                                        <button
                                            onClick={schedulePickupWithDelhivery}
                                            disabled={schedulingPickup || !selectedOrder?.trackingId}
                                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
                                        >
                                            {schedulingPickup ? (
                                                <>
                                                    <span className="animate-spin">⚙️</span>
                                                    Scheduling Pickup...
                                                </>
                                            ) : (
                                                <>
                                                    <MapPin size={18} />
                                                    Schedule Delhivery Pickup
                                                </>
                                            )}
                                        </button>
                                        
                                        <button
                                            onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
                                            className={`w-full font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                                                autoRefreshEnabled
                                                    ? 'bg-green-600 hover:bg-green-700 text-white'
                                                    : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                                            }`}
                                        >
                                            <RefreshCw size={18} />
                                            {autoRefreshEnabled ? `Auto-Refresh ON (Every ${refreshInterval}s)` : 'Auto-Refresh OFF'}
                                        </button>
                                    </div>
                                )}

                                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-2">
                                    {(() => {
                                        const currentOrderStatus = String(selectedOrder?.status || '').toUpperCase();
                                        const isGeoHaulUpdateDisabledByStatus = [
                                            'PICKED_UP',
                                            'WAREHOUSE_RECEIVED',
                                            'SHIPPED',
                                            'OUT_FOR_DELIVERY',
                                            'DELIVERED',
                                            'CANCELLED',
                                            'RETURNED'
                                        ].includes(currentOrderStatus);

                                        return (
                                            <>
                                    <button
                                        onClick={() => syncOrderWithGeoHaul('create')}
                                        disabled={syncingGeoHaul}
                                        className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-medium py-2.5 rounded-lg transition-colors"
                                    >
                                        {syncingGeoHaul ? 'Syncing...' : 'Create GeoHaul Consignment'}
                                    </button>
                                    <button
                                        onClick={() => syncOrderWithGeoHaul('update')}
                                        disabled={
                                            syncingGeoHaul ||
                                            !(selectedOrder?.trackingId || trackingData.trackingId) ||
                                            isGeoHaulUpdateDisabledByStatus
                                        }
                                        className="w-full bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white font-medium py-2.5 rounded-lg transition-colors"
                                    >
                                        Update GeoHaul
                                    </button>
                                    <button
                                        onClick={() => syncOrderWithGeoHaul('cancel')}
                                        disabled={
                                            syncingGeoHaul ||
                                            !(selectedOrder?.trackingId || trackingData.trackingId) ||
                                            ['CANCELLED', 'DELIVERED'].includes(String(selectedOrder?.status || '').toUpperCase())
                                        }
                                        className="w-full bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white font-medium py-2.5 rounded-lg transition-colors"
                                    >
                                        Cancel GeoHaul
                                    </button>
                                            </>
                                        );
                                    })()}
                                </div>

                            </div>

                            {/* Return/Replacement Request Section */}
                            {selectedOrder.returns && selectedOrder.returns.length > 0 && (
                                <div className="bg-gradient-to-br from-pink-50 to-pink-100 border border-pink-200 rounded-xl p-5">
                                    <h3 className="text-lg font-semibold text-pink-900 mb-4">Return/Replacement Requests</h3>
                                    
                                    <div className="space-y-4">
                                        {selectedOrder.returns.map((returnRequest, idx) => (
                                            <div key={idx} className="bg-white rounded-lg p-4 border border-pink-200">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                                        returnRequest.type === 'RETURN' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                                                    }`}>
                                                        {returnRequest.type}
                                                    </span>
                                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                                        returnRequest.status === 'REQUESTED' ? 'bg-yellow-100 text-yellow-700' :
                                                        returnRequest.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                                                        returnRequest.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                                                        'bg-slate-100 text-slate-700'
                                                    }`}>
                                                        {returnRequest.status}
                                                    </span>
                                                    <span className="text-xs text-slate-500 ml-auto">{new Date(returnRequest.requestedAt).toLocaleString()}</span>
                                                </div>

                                                <div className="space-y-2 text-sm">
                                                    <div>
                                                        <p className="text-slate-600 font-medium">Reason:</p>
                                                        <p className="text-slate-900">{returnRequest.reason}</p>
                                                    </div>
                                                    
                                                    {returnRequest.description && (
                                                        <div>
                                                            <p className="text-slate-600 font-medium">Description:</p>
                                                            <p className="text-slate-900">{returnRequest.description}</p>
                                                        </div>
                                                    )}

                                                    {returnRequest.images && returnRequest.images.length > 0 && (
                                                        <div>
                                                            <p className="text-slate-600 font-medium mb-2">Images:</p>
                                                            <div className="flex gap-2 flex-wrap">
                                                                {returnRequest.images.map((img, imgIdx) => (
                                                                    <a 
                                                                        key={imgIdx} 
                                                                        href={img} 
                                                                        target="_blank" 
                                                                        rel="noopener noreferrer"
                                                                    >
                                                                        <img 
                                                                            src={img} 
                                                                            alt={`Return ${imgIdx + 1}`}
                                                                            className="w-24 h-24 object-cover rounded-lg border-2 border-pink-200 hover:border-pink-400 transition cursor-pointer"
                                                                        />
                                                                    </a>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {returnRequest.status === 'REQUESTED' && (
                                                        <div className="flex gap-2 pt-3">
                                                            <button
                                                                onClick={async () => {
                                                                    try {
                                                                        const token = await getToken(true);
                                                                        await axios.post('/api/store/return-requests', {
                                                                            orderId: selectedOrder._id,
                                                                            returnIndex: idx,
                                                                            action: 'APPROVE'
                                                                        }, {
                                                                            headers: { Authorization: `Bearer ${token}` }
                                                                        });
                                                                        toast.success('Approved!');
                                                                        fetchOrders();
                                                                        closeModal();
                                                                    } catch (error) {
                                                                        toast.error(error?.response?.data?.error || 'Failed');
                                                                    }
                                                                }}
                                                                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
                                                            >
                                                                ✓ Approve
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setRejectingReturnIndex(idx);
                                                                    setShowRejectModal(true);
                                                                }}
                                                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium"
                                                            >
                                                                ✗ Reject
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Customer Details */}
                            <div className="bg-slate-50 rounded-xl p-5">
                                <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                    <div className="w-1 h-5 bg-blue-600 rounded-full"></div>
                                    Customer Details
                                    {selectedOrder.isGuest && (
                                        <span className="ml-2 px-2 py-1 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full">
                                            GUEST ORDER
                                        </span>
                                    )}
                                </h3>
                                
                                {!selectedOrder.shippingAddress && !selectedOrder.isGuest && (
                                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                                        <p className="text-yellow-800 text-sm">
                                            ⚠️ Shipping address not available for this order. This order was placed before address tracking was implemented.
                                        </p>
                                        {selectedOrder.userId && (
                                            <p className="text-yellow-700 text-xs mt-2">
                                                Customer: {selectedOrder.customerName || selectedOrder.shippingAddress?.name || selectedOrder.userId?.name || selectedOrder.userId?.email || 'Unknown'}
                                            </p>
                                        )}
                                    </div>
                                )}
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <p className="text-slate-500">Name</p>
                                        <p className="font-medium text-slate-900">
                                            {selectedOrder.isGuest 
                                                ? (selectedOrder.guestName || '—') 
                                                : (selectedOrder.shippingAddress?.name || selectedOrder.userId?.name || '—')}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-slate-500">Email</p>
                                        <p className="font-medium text-slate-900">
                                            {selectedOrder.isGuest 
                                                ? (selectedOrder.guestEmail || '—') 
                                                : (selectedOrder.shippingAddress?.email || selectedOrder.userId?.email || '—')}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-slate-500">Phone</p>
                                        <p className="font-medium text-slate-900">
                                            {selectedOrder.isGuest 
                                                ? ([selectedOrder.shippingAddress?.phoneCode, selectedOrder.guestPhone].filter(Boolean).join(' ') || '—')
                                                : ([selectedOrder.shippingAddress?.phoneCode, selectedOrder.shippingAddress?.phone].filter(Boolean).join(' ') || '—')}
                                        </p>
                                    </div>
                                    {(selectedOrder.shippingAddress?.alternatePhone || selectedOrder.alternatePhone) && (
                                        <div>
                                            <p className="text-slate-500">Alternate Phone</p>
                                            <p className="font-medium text-slate-900">
                                                {selectedOrder.isGuest
                                                    ? [selectedOrder.alternatePhoneCode || selectedOrder.shippingAddress?.phoneCode || '+971', selectedOrder.alternatePhone || selectedOrder.shippingAddress?.alternatePhone].filter(Boolean).join(' ')
                                                    : [selectedOrder.shippingAddress?.alternatePhoneCode || selectedOrder.shippingAddress?.phoneCode || '+971', selectedOrder.shippingAddress?.alternatePhone || selectedOrder.alternatePhone].filter(Boolean).join(' ')}
                                            </p>
                                        </div>
                                    )}
                                    <div>
                                        <p className="text-slate-500">Street</p>
                                        <p className="font-medium text-slate-900">{selectedOrder.shippingAddress?.street || '—'}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-500">City</p>
                                        <p className="font-medium text-slate-900">{selectedOrder.shippingAddress?.city || '—'}</p>
                                    </div>
                                    {selectedOrder.shippingAddress?.district && selectedOrder.shippingAddress.district.trim() !== '' && (
                                        <div>
                                            <p className="text-slate-500">District</p>
                                            <p className="font-medium text-slate-900">{selectedOrder.shippingAddress.district}</p>
                                        </div>
                                    )}
                                    <div>
                                        <p className="text-slate-500">State</p>
                                        <p className="font-medium text-slate-900">{selectedOrder.shippingAddress?.state || '—'}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-500">Pincode</p>
                                        <p className="font-medium text-slate-900">{selectedOrder.shippingAddress?.zip || selectedOrder.shippingAddress?.pincode || '—'}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-500">Country</p>
                                        <p className="font-medium text-slate-900">{selectedOrder.shippingAddress?.country || '—'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Products */}
                            <div>
                                <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                    <div className="w-1 h-5 bg-green-600 rounded-full"></div>
                                    Order Items
                                </h3>
                                <div className="space-y-3">
                                    {selectedOrder.orderItems.map((item, i) => (
                                        <div key={i} className="flex items-center gap-4 border border-slate-200 rounded-xl p-3 bg-white hover:shadow-md transition-shadow">
                                            <img
                                                src={item.productId?.images?.[0] || item.product?.images?.[0] || '/placeholder.png'}
                                                alt={item.productId?.name || item.product?.name || 'Product'}
                                                className="w-20 h-20 object-cover rounded-lg border border-slate-100"
                                            />
                                            <div className="flex-1">
                                                <p className="font-medium text-slate-900">{item.productId?.name || item.product?.name || 'Unknown Product'}</p>
                                                <p className="text-sm text-slate-600">Quantity: {item.quantity}</p>
                                                <p className="text-sm font-semibold text-slate-900">{currency}{item.price} each</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-lg font-bold text-slate-900">{currency}{item.price * item.quantity}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Payment & Status */}
                            <div className="bg-slate-50 rounded-xl p-5">
                                <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                    <div className="w-1 h-5 bg-purple-600 rounded-full"></div>
                                    Payment & Status
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm mb-4">
                                    <div>
                                        <p className="text-slate-500">Total Amount</p>
                                        <p className="text-xl font-bold text-slate-900">{currency}{selectedOrder.total}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-500">Payment Method</p>
                                        <p className="font-medium text-slate-900">{selectedOrder.paymentMethod}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-500">Payment Status</p>
                                        <p className="font-medium text-slate-900">{getPaymentStatus(selectedOrder) ? "✓ Paid" : "Pending"}</p>
                                    </div>
                                    
                                    {/* Delhivery Payment Collection Info */}
                                    {selectedOrder.delhivery?.payment && (
                                        <>
                                            {selectedOrder.delhivery.payment.is_cod_recovered && (
                                                <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                                                    <p className="text-sm text-green-700 font-medium">✓ Payment Collected by Delhivery</p>
                                                    {selectedOrder.delhivery.payment.cod_amount > 0 && (
                                                        <p className="text-sm text-green-600 mt-1">
                                                            Amount: AED{selectedOrder.delhivery.payment.cod_amount}
                                                        </p>
                                                    )}
                                                    {selectedOrder.delhivery.payment.payment_collected_at && (
                                                        <p className="text-xs text-green-500 mt-1">
                                                            Collected: {new Date(selectedOrder.delhivery.payment.payment_collected_at).toLocaleDateString()}
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    )}
                                    
                                    {/* Razorpay Payment Settlement Info */}
                                    {selectedOrder.razorpayPaymentId && (
                                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                                            <p className="text-sm text-blue-700 font-medium">💳 Card Payment (Razorpay)</p>
                                            <p className="text-xs text-blue-600 mt-1">Payment ID: {selectedOrder.razorpayPaymentId.slice(-8)}</p>
                                            {selectedOrder.razorpaySettlement?.is_transferred && (
                                                <p className="text-xs text-green-600 mt-1">✓ Transferred to Bank Account</p>
                                            )}
                                            {!selectedOrder.razorpaySettlement?.is_transferred && (
                                                <p className="text-xs text-amber-600 mt-1">⏳ Pending transfer to bank</p>
                                            )}
                                            <button
                                                onClick={() => checkRazorpaySettlement(selectedOrder)}
                                                className="mt-2 w-full px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700 transition"
                                            >
                                                Check Settlement Status
                                            </button>
                                        </div>
                                    )}
                                    
                                    {selectedOrder.isCouponUsed && (
                                        <div>
                                            <p className="text-slate-500">Coupon Used</p>
                                            <p className="font-medium text-green-600">{selectedOrder.coupon.code} (-AED{Number(selectedOrder.coupon.discountAmount ?? selectedOrder.coupon.discount ?? 0).toFixed(2)})</p>
                                        </div>
                                    )}
                                    <div>
                                        <p className="text-slate-500">Order Date</p>
                                        <p className="font-medium text-slate-900">{formatOrderDateTime(selectedOrder.createdAt)}</p>
                                    </div>
                                </div>

                                {/* Order Status Selector */}
                                <div className="border-t border-slate-200 pt-4">
                                    <label className="text-slate-600 font-semibold block mb-2 text-sm">Update Order Status</label>
                                    <div className="flex gap-2">
                                        <select
                                            value={selectedOrder.status}
                                            onChange={async (e) => {
                                                const newStatus = e.target.value;
                                                try {
                                                    const token = await getToken(true);
                                                    if (!token) {
                                                        toast.error('Authentication failed. Please sign in again.');
                                                        return;
                                                    }
                                                    await axios.post('/api/store/orders/update-status', {
                                                        orderId: selectedOrder._id,
                                                        status: newStatus
                                                    }, {
                                                        headers: { Authorization: `Bearer ${token}` }
                                                    });
                                                    toast.success('Order status updated!');
                                                    setSelectedOrder({...selectedOrder, status: newStatus});
                                                    fetchOrders();
                                                } catch (error) {
                                                    console.error('Update status error:', error);
                                                    toast.error(error?.response?.data?.error || 'Failed to update status');
                                                }
                                            }}
                                            className={`flex-1 border-slate-300 rounded-lg text-sm font-medium px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none transition ${getStatusColor(selectedOrder.status)}`}
                                        >
                                            {STATUS_OPTIONS.map(status => (
                                                <option key={status.value} value={status.value}>{status.label}</option>
                                            ))}
                                        </select>
                                        <span className={`px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap flex items-center ${getStatusColor(selectedOrder.status)}`}>
                                            {selectedOrder.status}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={async () => {
                                        if (!window.confirm('Are you sure you want to delete this order? This action cannot be undone.')) return;
                                        try {
                                            const token = await getToken();
                                            await axios.delete(`/api/store/orders/${selectedOrder._id}`, {
                                                headers: { Authorization: `Bearer ${token}` }
                                            });
                                            toast.success('Order deleted successfully');
                                            setIsModalOpen(false);
                                            fetchOrders();
                                        } catch (error) {
                                            toast.error(error?.response?.data?.error || 'Failed to delete order');
                                        }
                                    }}
                                    className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors shadow backdrop-blur-sm"
                                    title="Delete Order"
                                >
                                    <X size={18} />
                                    <span className="text-sm">Delete</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Rejection Reason Modal */}
            {showRejectModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[70] p-4" onClick={() => {
                    setShowRejectModal(false);
                    setRejectReason('');
                    setRejectingReturnIndex(null);
                }}>
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8 transform transition-all" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10"/>
                                    <line x1="15" y1="9" x2="9" y2="15"/>
                                    <line x1="9" y1="9" x2="15" y2="15"/>
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold text-slate-900">Reject Request</h3>
                                <p className="text-sm text-slate-500">Provide a clear reason for the customer</p>
                            </div>
                        </div>
                        
                        <div className="mb-6">
                            <label className="block text-sm font-semibold text-slate-700 mb-3">
                                Rejection Reason <span className="text-red-600">*</span>
                            </label>
                            <textarea
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="Example: Product shows no defects upon inspection. Please contact support if you believe this is an error."
                                rows="5"
                                className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none text-sm"
                            />
                            <p className="text-xs text-slate-500 mt-2">This message will be visible to the customer in their order dashboard</p>
                        </div>
                        
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowRejectModal(false);
                                    setRejectReason('');
                                    setRejectingReturnIndex(null);
                                }}
                                className="flex-1 px-6 py-3 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 transition font-semibold"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    if (!rejectReason.trim()) {
                                        toast.error('Please provide a rejection reason');
                                        return;
                                    }
                                    try {
                                        const token = await getToken(true);
                                        await axios.post('/api/store/return-requests', {
                                            orderId: selectedOrder._id,
                                            returnIndex: rejectingReturnIndex,
                                            action: 'REJECT',
                                            rejectionReason: rejectReason.trim()
                                        }, {
                                            headers: { Authorization: `Bearer ${token}` }
                                        });
                                        toast.success('Return request rejected successfully');
                                        setShowRejectModal(false);
                                        setRejectReason('');
                                        setRejectingReturnIndex(null);
                                        fetchOrders();
                                        closeModal();
                                    } catch (error) {
                                        toast.error(error?.response?.data?.error || 'Failed to reject request');
                                    }
                                }}
                                disabled={!rejectReason.trim()}
                                className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-600/30"
                            >
                                Confirm Rejection
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
