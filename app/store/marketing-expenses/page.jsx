"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import Loading from "@/components/Loading";
import axios from "axios";
import toast from "react-hot-toast";
import { 
    TrendingUp, 
    DollarSign, 
    MousePointerClick,
    Eye,
    Target,
    Calendar,
    Plus,
    Trash2,
    Facebook,
    Instagram,
    Search as GoogleIcon,
    ArrowLeft,
    RefreshCw,
    X,
    ArrowUpDown
} from "lucide-react";
import Link from "next/link";

export default function MarketingExpenses() {
    const currency = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || 'AED';
    const { user, getToken, loading: authLoading } = useAuth();
    const router = useRouter();
    
    const [loading, setLoading] = useState(true);
    const [expenses, setExpenses] = useState([]);
    const [totals, setTotals] = useState(null);
    const [dateRange, setDateRange] = useState('THIS_MONTH');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [showConnectModal, setShowConnectModal] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [metaConnected, setMetaConnected] = useState(false);
    const [lastSynced, setLastSynced] = useState(null);
    const [sortOrder, setSortOrder] = useState('desc');
    const [metaCredentials, setMetaCredentials] = useState({
        accessToken: '',
        adAccountId: ''
    });
    
    const [formData, setFormData] = useState({
        campaignName: '',
        campaignType: 'SALES',
        platform: 'FACEBOOK',
        amount: '',
        clicks: '',
        impressions: '',
        reach: '',
        conversions: '',
        startDate: '',
        endDate: '',
        notes: ''
    });
    
    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
        if (user) {
            checkMetaConnection();
        }
    }, [user, authLoading]);
    
    useEffect(() => {
        if (user && metaConnected) {
            autoSyncMeta();
            fetchExpenses();
        } else if (user) {
            fetchExpenses();
        }
    }, [user, dateRange, fromDate, toDate, metaConnected]);
    
    const checkMetaConnection = async () => {
        try {
            const token = await getToken(true);
            const response = await axios.get('/api/store/meta-integration', {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (response.data.connected) {
                setMetaConnected(true);
                setLastSynced(response.data.integration.lastSyncedAt);
            } else {
                setMetaConnected(false);
            }
        } catch (error) {
            console.error('Error checking Meta connection:', error);
            setMetaConnected(false);
        }
    };
    
    const autoSyncMeta = async () => {
        try {
            setSyncing(true);
            const token = await getToken(true);
            
            await axios.post('/api/store/marketing-expenses/sync-meta', 
                { dateRange },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            setLastSynced(new Date());
            toast.success('Meta data synced successfully');
        } catch (error) {
            console.error('Auto-sync error:', error);
            const errorMessage = error.response?.data?.error || 'Failed to sync Meta data';
            toast.error(errorMessage);
            // If integration not configured, mark as not connected
            if (error.response?.status === 400) {
                setMetaConnected(false);
            }
        } finally {
            setSyncing(false);
        }
    };
    
    const fetchExpenses = async () => {
        try {
            setLoading(true);
            const token = await getToken(true);
            if (!token) {
                toast.error('Authentication failed');
                return;
            }
            
            const response = await axios.get('/api/store/marketing-expenses', {
                params: { dateRange, fromDate, toDate },
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // Group expenses by campaign name and date range
            const expensesMap = new Map();
            (response.data.expenses || []).forEach(expense => {
                const key = `${expense.campaignName}-${expense.platform}-${new Date(expense.startDate).toLocaleDateString()}`;
                
                if (expensesMap.has(key)) {
                    // Merge duplicate campaigns - sum up metrics
                    const existing = expensesMap.get(key);
                    existing.amount += (expense.amount || 0);
                    existing.clicks = (existing.clicks || 0) + (expense.clicks || 0);
                    existing.impressions = (existing.impressions || 0) + (expense.impressions || 0);
                    existing.conversions = (existing.conversions || 0) + (expense.conversions || 0);
                    existing.reach = Math.max(existing.reach || 0, expense.reach || 0); // Use max reach, not sum
                } else {
                    expensesMap.set(key, { ...expense });
                }
            });
            
            // Convert map back to array and sort
            const sortedExpenses = Array.from(expensesMap.values()).sort((a, b) => {
                const dateA = new Date(a.startDate || a.createdAt);
                const dateB = new Date(b.startDate || b.createdAt);
                return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
            });
            
            setExpenses(sortedExpenses);
            setTotals(response.data.totals);
        } catch (error) {
            console.error('Error fetching expenses:', error);
            toast.error(error?.response?.data?.error || 'Failed to load expenses');
        } finally {
            setLoading(false);
        }
    };
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const token = await getToken(true);
            
            await axios.post('/api/store/marketing-expenses', formData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            toast.success('Marketing expense added successfully!');
            setShowAddModal(false);
            setFormData({
                campaignName: '',
                campaignType: 'SALES',
                platform: 'FACEBOOK',
                amount: '',
                clicks: '',
                impressions: '',
                reach: '',
                conversions: '',
                startDate: '',
                endDate: '',
                notes: ''
            });
            fetchExpenses();
        } catch (error) {
            console.error('Error adding expense:', error);
            toast.error(error?.response?.data?.error || 'Failed to add expense');
        }
    };
    
    const handleConnectMeta = async (e) => {
        e.preventDefault();
        setSyncing(true);
        
        try {
            const token = await getToken(true);
            
            // Save credentials
            await axios.post('/api/store/meta-integration', 
                metaCredentials,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            toast.success('Meta account connected successfully!');
            setShowConnectModal(false);
            setMetaConnected(true);
            setMetaCredentials({ accessToken: '', adAccountId: '' });
            
            // Auto-sync after connecting
            autoSyncMeta();
            fetchExpenses();
        } catch (error) {
            console.error('Meta connection error:', error);
            toast.error(error?.response?.data?.error || 'Failed to connect Meta account');
        } finally {
            setSyncing(false);
        }
    };
    
    const handleDisconnectMeta = async () => {
        if (!confirm('Are you sure you want to disconnect your Meta account?')) return;
        
        try {
            const token = await getToken(true);
            
            await axios.delete('/api/store/meta-integration', {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            toast.success('Meta account disconnected');
            setMetaConnected(false);
            setLastSynced(null);
        } catch (error) {
            console.error('Disconnect error:', error);
            toast.error('Failed to disconnect Meta account');
        }
    };
    
    const handleSyncMeta = async (e) => {
        e.preventDefault();
        setSyncing(true);
        
        try {
            const token = await getToken(true);
            
            const response = await axios.post('/api/store/marketing-expenses/sync-meta', 
                { dateRange },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            toast.success(`Successfully synced ${response.data.totalSynced} campaigns from Meta!`);
            setLastSynced(new Date());
            fetchExpenses();
        } catch (error) {
            console.error('Meta sync error:', error);
            toast.error(error?.response?.data?.error || 'Failed to sync with Meta');
        } finally {
            setSyncing(false);
        }
    };
    
    const handleDelete = async (expenseId) => {
        if (!confirm('Are you sure you want to delete this expense?')) return;
        
        try {
            const token = await getToken(true);
            
            await axios.delete(`/api/store/marketing-expenses?id=${expenseId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            toast.success('Expense deleted successfully');
            fetchExpenses();
        } catch (error) {
            console.error('Error deleting expense:', error);
            toast.error('Failed to delete expense');
        }
    };
    
    const handleCleanupDuplicates = async () => {
        if (!confirm('This will merge duplicate campaign entries in the database. Continue?')) return;
        
        try {
            const token = await getToken(true);
            
            await axios.post('/api/store/marketing-expenses/cleanup-duplicates', {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            toast.success('Duplicates cleaned up successfully');
            fetchExpenses();
        } catch (error) {
            console.error('Error cleaning duplicates:', error);
            toast.error('Failed to cleanup duplicates');
        }
    };
    
    const toggleSortOrder = () => {
        const newOrder = sortOrder === 'desc' ? 'asc' : 'desc';
        setSortOrder(newOrder);
        
        const sorted = [...expenses].sort((a, b) => {
            const dateA = new Date(a.startDate || a.createdAt);
            const dateB = new Date(b.startDate || b.createdAt);
            return newOrder === 'desc' ? dateB - dateA : dateA - dateB;
        });
        setExpenses(sorted);
    };
    
    const getCampaignTypeColor = (type) => {
        const colors = {
            AWARENESS: 'bg-blue-100 text-blue-700 border-blue-200',
            CONSIDERATION: 'bg-purple-100 text-purple-700 border-purple-200',
            CONVERSION: 'bg-orange-100 text-orange-700 border-orange-200',
            SALES: 'bg-emerald-100 text-emerald-700 border-emerald-200',
            OTHER: 'bg-slate-100 text-slate-700 border-slate-200'
        };
        return colors[type] || colors.OTHER;
    };
    
    const getPlatformIcon = (platform) => {
        switch(platform) {
            case 'FACEBOOK':
                return <Facebook size={16} className="text-blue-600" />;
            case 'INSTAGRAM':
                return <Instagram size={16} className="text-pink-600" />;
            case 'GOOGLE':
                return <GoogleIcon size={16} className="text-red-600" />;
            default:
                return <Target size={16} className="text-slate-600" />;
        }
    };
    
    if (authLoading || loading) {
        return <Loading />;
    }
    
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-white p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/store/sales-report">
                            <button className="p-2 hover:bg-white rounded-lg border border-slate-200 transition-all">
                                <ArrowLeft size={20} />
                            </button>
                        </Link>
                        <div>
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
                                Marketing Expenses
                            </h1>
                            <p className="text-slate-600 mt-1">Track and manage your marketing campaigns</p>
                        </div>
                    </div>
                    
                    <div className="flex gap-3">
                        {metaConnected ? (
                            <>
                                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                                    <span className="text-sm text-emerald-700 font-medium">Meta Connected</span>
                                    {lastSynced && (
                                        <span className="text-xs text-emerald-600">
                                            • Synced {new Date(lastSynced).toLocaleTimeString()}
                                        </span>
                                    )}
                                </div>
                                <button
                                    onClick={handleSyncMeta}
                                    disabled={syncing}
                                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center gap-2 font-medium shadow-lg disabled:opacity-50"
                                >
                                    {syncing ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                            Syncing...
                                        </>
                                    ) : (
                                        <>
                                            <RefreshCw size={18} />
                                            Refresh Data
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={handleDisconnectMeta}
                                    className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-all flex items-center gap-2 font-medium"
                                >
                                    <X size={18} />
                                    Disconnect
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => setShowConnectModal(true)}
                                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center gap-2 font-medium shadow-lg"
                            >
                                <Facebook size={18} />
                                Connect Meta Account
                            </button>
                        )}
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="px-4 py-2 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-lg hover:from-pink-700 hover:to-purple-700 transition-all flex items-center gap-2 font-medium shadow-lg"
                        >
                            <Plus size={18} />
                            Add Manually
                        </button>
                    </div>
                </div>
                
                {/* Date Filters */}
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="flex gap-2 flex-wrap">
                        {['TODAY', 'THIS_WEEK', 'THIS_MONTH', 'LAST_MONTH', 'THIS_YEAR'].map((range) => (
                            <button
                                key={range}
                                onClick={() => setDateRange(range)}
                                className={`px-4 py-2 rounded-lg transition-all ${
                                    dateRange === range
                                        ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-lg'
                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                }`}
                            >
                                {range.replace('_', ' ')}
                            </button>
                        ))}
                    </div>
                </div>
                
                {/* Summary Cards */}
                {totals && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl shadow-xl p-6 text-white">
                            <div className="flex items-center justify-between">
                                <DollarSign className="w-12 h-12 opacity-80" />
                                <div className="text-right">
                                    <p className="text-sm opacity-90">Total Spend</p>
                                    <p className="text-3xl font-bold">{currency}{(totals.totalSpend || 0).toFixed(2)}</p>
                                </div>
                            </div>
                        </div>
                        
                        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-xl p-6 text-white">
                            <div className="flex items-center justify-between">
                                <MousePointerClick className="w-12 h-12 opacity-80" />
                                <div className="text-right">
                                    <p className="text-sm opacity-90">Total Clicks</p>
                                    <p className="text-3xl font-bold">{(totals.totalClicks || 0).toLocaleString()}</p>
                                    {totals.cpc > 0 && (
                                        <p className="text-xs opacity-75">CPC: {currency}{totals.cpc.toFixed(2)}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                        
                        <div className="bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl shadow-xl p-6 text-white">
                            <div className="flex items-center justify-between">
                                <Eye className="w-12 h-12 opacity-80" />
                                <div className="text-right">
                                    <p className="text-sm opacity-90">Impressions</p>
                                    <p className="text-3xl font-bold">{(totals.totalImpressions || 0).toLocaleString()}</p>
                                    {totals.ctr > 0 && (
                                        <p className="text-xs opacity-75">CTR: {totals.ctr.toFixed(2)}%</p>
                                    )}
                                </div>
                            </div>
                        </div>
                        
                        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-xl p-6 text-white">
                            <div className="flex items-center justify-between">
                                <TrendingUp className="w-12 h-12 opacity-80" />
                                <div className="text-right">
                                    <p className="text-sm opacity-90">Conversions</p>
                                    <p className="text-3xl font-bold">{(totals.totalConversions || 0).toLocaleString()}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                
                {/* Breakdown by Campaign Type */}
                {totals?.byType && Object.keys(totals.byType).length > 0 && (
                    <div className="bg-white rounded-xl border border-slate-200 p-6">
                        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                            <Target className="text-pink-600" />
                            By Campaign Type
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                            {Object.entries(totals.byType).map(([type, data]) => (
                                <div key={type} className={`p-4 rounded-lg border ${getCampaignTypeColor(type)}`}>
                                    <p className="text-sm font-medium mb-1">{type}</p>
                                    <p className="text-2xl font-bold">{currency}{(data?.totalSpend || 0).toFixed(2)}</p>
                                    <p className="text-xs opacity-75 mt-1">{data?.count || 0} campaigns</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                {/* Breakdown by Platform */}
                {totals?.byPlatform && Object.keys(totals.byPlatform).length > 0 && (
                    <div className="bg-white rounded-xl border border-slate-200 p-6">
                        <h3 className="text-lg font-semibold text-slate-800 mb-4">By Platform</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {Object.entries(totals.byPlatform).map(([platform, data]) => (
                                <div key={platform} className="p-4 rounded-lg border border-slate-200 bg-gradient-to-br from-slate-50 to-white">
                                    <div className="flex items-center gap-2 mb-2">
                                        {getPlatformIcon(platform)}
                                        <p className="text-sm font-medium text-slate-700">{platform}</p>
                                    </div>
                                    <p className="text-2xl font-bold text-slate-800">{currency}{(data?.totalSpend || 0).toFixed(2)}</p>
                                    <div className="mt-2 text-xs text-slate-600 space-y-1">
                                        <div className="flex justify-between">
                                            <span>Clicks:</span>
                                            <span className="font-medium">{(data?.totalClicks || 0).toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Campaigns:</span>
                                            <span className="font-medium">{data?.count || 0}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                {/* Expenses Table */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                        <h3 className="text-lg font-semibold text-slate-800">Campaign Details</h3>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Campaign</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Type</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Platform</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Spend</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Clicks</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Conversions</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                                        <button 
                                            onClick={toggleSortOrder}
                                            className="flex items-center gap-1 hover:text-slate-900 transition-colors"
                                            title="Sort by date"
                                        >
                                            Date
                                            <ArrowUpDown size={14} />
                                            <span className="text-[10px] text-slate-500">({sortOrder === 'desc' ? 'Newest' : 'Oldest'})</span>
                                        </button>
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {expenses.length === 0 ? (
                                    <tr>
                                        <td colSpan="8" className="px-6 py-12 text-center">
                                            <div className="text-slate-400">
                                                <Target className="w-16 h-16 mx-auto mb-3 opacity-50" />
                                                <p className="text-lg font-medium">No marketing expenses found</p>
                                                <p className="text-sm mt-1">
                                                    {metaConnected 
                                                        ? "Click 'Refresh Data' to sync or add manually" 
                                                        : "Connect Meta or add expenses manually"}
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    expenses.map((expense) => (
                                        <tr key={expense._id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-slate-900">{expense.campaignName}</div>
                                                {expense.notes && (
                                                    <div className="text-xs text-slate-500 mt-1">{expense.notes}</div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getCampaignTypeColor(expense.campaignType)}`}>
                                                    {expense.campaignType}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    {getPlatformIcon(expense.platform)}
                                                    <span className="text-sm text-slate-700">{expense.platform}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-semibold text-slate-900">
                                                {currency}{(expense.amount || 0).toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 text-slate-700">
                                                {expense.clicks?.toLocaleString() || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-slate-700">
                                                {expense.conversions?.toLocaleString() || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600">
                                                <div>
                                                    {new Date(expense.startDate || expense.createdAt).toLocaleDateString()}
                                                </div>
                                                {expense.startDate && expense.endDate && (
                                                    <div className="text-xs text-slate-400 mt-1">
                                                        to {new Date(expense.endDate).toLocaleDateString()}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={() => handleDelete(expense._id)}
                                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Delete expense"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            
            {/* Connect Meta Modal */}
            {showConnectModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full">
                        <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                            <div className="flex items-center gap-3">
                                <Facebook className="text-blue-600" size={32} />
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-800">Connect Meta Account</h2>
                                    <p className="text-sm text-slate-600 mt-1">One-time setup - Auto-sync forever!</p>
                                </div>
                            </div>
                        </div>
                        
                        <form onSubmit={handleConnectMeta} className="p-6 space-y-4">
                            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg mb-4">
                                <h4 className="font-semibold text-blue-900 mb-2">Setup once, auto-sync forever:</h4>
                                <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                                    <li>Go to <a href="https://business.facebook.com/settings/ad-accounts" target="_blank" className="underline">Meta Business Settings</a></li>
                                    <li>Find your Ad Account ID (format: 123456789012345)</li>
                                    <li>Go to <a href="https://developers.facebook.com/tools/explorer" target="_blank" className="underline">Graph API Explorer</a></li>
                                    <li>Generate a <strong>long-lived token</strong> with ads_read permission</li>
                                    <li>Enter both below - your data will sync automatically!</li>
                                </ol>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Ad Account ID *
                                    <span className="text-xs text-slate-500 ml-2">(Numbers only, e.g., 123456789012345)</span>
                                </label>
                                <input
                                    type="text"
                                    value={metaCredentials.adAccountId}
                                    onChange={(e) => setMetaCredentials({...metaCredentials, adAccountId: e.target.value})}
                                    placeholder="2020620678760567"
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    required
                                />
                                <p className="text-xs text-slate-500 mt-1">
                                    ⚠️ Enter numbers only (don't include "act_" prefix or spaces)
                                </p>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Access Token * (Long-lived recommended)
                                    <span className="text-xs text-slate-500 ml-2">(From Graph API Explorer)</span>
                                </label>
                                <textarea
                                    value={metaCredentials.accessToken}
                                    onChange={(e) => setMetaCredentials({...metaCredentials, accessToken: e.target.value})}
                                    placeholder="EAABs..."
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                                    rows="3"
                                    required
                                />
                            </div>
                            
                            <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-lg">
                                <p className="text-sm text-emerald-800">
                                    <strong>✨ Auto-Sync Benefits:</strong><br/>
                                    • Automatically fetch latest ad data when you open dashboard<br/>
                                    • Always see current spend, clicks, conversions<br/>
                                    • No manual sync needed - it just works!<br/>
                                    • Secure storage - only you can access
                                </p>
                            </div>
                            
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="submit"
                                    disabled={syncing}
                                    className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {syncing ? (
                                        <>
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                            Connecting...
                                        </>
                                    ) : (
                                        <>
                                            <Facebook size={18} />
                                            Connect & Auto-Sync
                                        </>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowConnectModal(false)}
                                    disabled={syncing}
                                    className="px-6 py-3 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-all font-medium disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            
            {/* Add Manually Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full my-8">
                        <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-pink-50 to-purple-50">
                            <h2 className="text-2xl font-bold text-slate-800">Add Marketing Expense</h2>
                            <p className="text-sm text-slate-600 mt-1">Manually track your campaign expenses</p>
                        </div>
                        
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Campaign Name *</label>
                                <input
                                    type="text"
                                    value={formData.campaignName}
                                    onChange={(e) => setFormData({...formData, campaignName: e.target.value})}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                                    required
                                    placeholder="e.g., Summer Sale 2024"
                                />
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Start Date *</label>
                                    <input
                                        type="date"
                                        value={formData.startDate}
                                        onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                                        required
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">End Date</label>
                                    <input
                                        type="date"
                                        value={formData.endDate}
                                        onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                                    />
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Campaign Type</label>
                                    <select
                                        value={formData.campaignType}
                                        onChange={(e) => setFormData({...formData, campaignType: e.target.value})}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                                    >
                                        <option value="AWARENESS">Awareness</option>
                                        <option value="CONSIDERATION">Consideration</option>
                                        <option value="CONVERSION">Conversion</option>
                                        <option value="SALES">Sales</option>
                                        <option value="OTHER">Other</option>
                                    </select>
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Platform</label>
                                    <select
                                        value={formData.platform}
                                        onChange={(e) => setFormData({...formData, platform: e.target.value})}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                                    >
                                        <option value="FACEBOOK">Facebook</option>
                                        <option value="INSTAGRAM">Instagram</option>
                                        <option value="GOOGLE">Google</option>
                                        <option value="OTHER">Other</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Amount Spent ({currency})*</label>
                                    <input
                                        type="number"
                                        value={formData.amount}
                                        onChange={(e) => setFormData({...formData, amount: e.target.value})}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                                        required
                                        min="0"
                                        step="0.01"
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Clicks</label>
                                    <input
                                        type="number"
                                        value={formData.clicks}
                                        onChange={(e) => setFormData({...formData, clicks: e.target.value})}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                                        min="0"
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Impressions</label>
                                    <input
                                        type="number"
                                        value={formData.impressions}
                                        onChange={(e) => setFormData({...formData, impressions: e.target.value})}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                                        min="0"
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Reach</label>
                                    <input
                                        type="number"
                                        value={formData.reach}
                                        onChange={(e) => setFormData({...formData, reach: e.target.value})}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                                        min="0"
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Conversions</label>
                                    <input
                                        type="number"
                                        value={formData.conversions}
                                        onChange={(e) => setFormData({...formData, conversions: e.target.value})}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                                        min="0"
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Notes (Optional)</label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                                    rows="3"
                                    placeholder="Additional campaign details..."
                                ></textarea>
                            </div>
                            
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="submit"
                                    className="flex-1 px-6 py-3 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-lg hover:from-pink-700 hover:to-purple-700 transition-all font-medium"
                                >
                                    Add Expense
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="px-6 py-3 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-all font-medium"
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
