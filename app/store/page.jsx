'use client'
import Loading from "@/components/Loading"


import axios from "axios"
import { CircleDollarSignIcon, CreditCardIcon, PackageCheckIcon, PackageIcon, ShoppingBasketIcon, StarIcon, TagsIcon, TruckIcon, UsersIcon, ShoppingCartIcon, UserPlusIcon, XCircleIcon } from "lucide-react"
import ContactMessagesSeller from "./ContactMessagesSeller.jsx";
import Link from "next/link"
import { useEffect, useState } from "react"
import toast from "react-hot-toast"
import { useAuth } from '@/lib/useAuth'

// Rename export to avoid conflict with import
export const dynamicSetting = 'force-dynamic'

const createDateTimeValue = (date, endOfDay = false) => {
    const value = new Date(date)
    if (endOfDay) {
        value.setHours(23, 59, 0, 0)
    } else {
        value.setHours(0, 0, 0, 0)
    }

    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    const hours = String(value.getHours()).padStart(2, '0')
    const minutes = String(value.getMinutes()).padStart(2, '0')

    return `${year}-${month}-${day}T${hours}:${minutes}`
}

const formatDateTimeLabel = (value) => {
    if (!value) return 'N/A'
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return 'N/A'

    return parsed.toLocaleString([], {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    })
}

export default function Dashboard() {
    const { user, loading: authLoading, getToken } = useAuth();
    const currency = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || 'AED'
    const [loading, setLoading] = useState(true)
    const [dateRange, setDateRange] = useState(() => ({
        from: createDateTimeValue(new Date()),
        to: createDateTimeValue(new Date(), true),
    }))
    const [dashboardData, setDashboardData] = useState({
        totalProducts: 0,
        totalEarnings: 0,
        totalOrders: 0,
        totalCustomers: 0,
        abandonedCarts: 0,
        ratings: [],
        overview: {
            todayOrders: 0,
            totalDelivered: 0,
            paidByCard: 0,
            codOrders: 0,
            inTransit: 0,
            pendingPayment: 0,
            cancelled: 0,
            deliveredEarnings: 0,
        },
        rangeSummary: {
            from: null,
            to: null,
            ordersInRange: 0,
            unitsSoldInRange: 0,
            products: [],
        },
    })

    const dashboardOverviewCards = [
        { title: "Today's Orders", value: dashboardData.overview?.todayOrders ?? 0, icon: TagsIcon },
        { title: 'Total Delivered', value: dashboardData.overview?.totalDelivered ?? 0, icon: PackageCheckIcon },
        { title: 'Paid by Card', value: dashboardData.overview?.paidByCard ?? 0, icon: CreditCardIcon },
        { title: 'COD Orders', value: dashboardData.overview?.codOrders ?? 0, icon: ShoppingCartIcon },
        { title: 'In Transit', value: dashboardData.overview?.inTransit ?? 0, icon: TruckIcon },
        { title: 'Pending Payment', value: dashboardData.overview?.pendingPayment ?? 0, icon: CircleDollarSignIcon },
        { title: 'Canceled', value: dashboardData.overview?.cancelled ?? 0, icon: XCircleIcon },
        { title: 'Earnings (Delivered)', value: `${currency}${dashboardData.overview?.deliveredEarnings ?? 0}`, icon: CircleDollarSignIcon },
    ]

    const dashboardCardsData = [
        { title: 'Total Products', value: dashboardData.totalProducts, icon: ShoppingBasketIcon },
        { title: 'Total Earnings', value: currency + dashboardData.totalEarnings, icon: CircleDollarSignIcon },
        { title: 'Total Orders', value: dashboardData.totalOrders, icon: TagsIcon },
        { title: 'Total Customers', value: dashboardData.totalCustomers, icon: UsersIcon },
        { title: 'Abandoned Carts', value: dashboardData.abandonedCarts, icon: ShoppingCartIcon },
        { title: 'Total Ratings', value: (dashboardData.totalRatings ?? dashboardData.ratings?.length ?? 0), icon: StarIcon },
    ]

    useEffect(() => {
        const fetchDashboard = async () => {
            if (!user) {
                setLoading(false);
                return;
            }

            try {
                const startedAt = performance.now();
                const token = await getToken();
                const response = await axios.get('/api/store/dashboard', {
                    params: {
                        from: dateRange.from,
                        to: dateRange.to,
                    },
                    headers: { Authorization: `Bearer ${token}` }
                });
                const { data } = response;
                const apiMs = response.headers?.['x-dashboard-api-ms'];
                console.info('[store/page] dashboard fetch timing', {
                    durationMs: Math.round(performance.now() - startedAt),
                    apiMs: apiMs ? Number(apiMs) : null,
                });
                setDashboardData(data.dashboardData);
            } catch (error) {
                toast.error(error?.response?.data?.error || 'Failed to load dashboard');
            } finally {
                setLoading(false);
            }
        };

        if (!authLoading) {
            fetchDashboard();
        }
    }, [authLoading, user, dateRange.from, dateRange.to]);

    if (authLoading || loading) return <Loading />

    if (!user) {
        return (
            <div className="min-h-[80vh] mx-6 flex items-center justify-center text-slate-400">
                <h1 className="text-2xl sm:text-4xl font-semibold">Please <span className="text-slate-500">Login</span> to view your dashboard</h1>
            </div>
        );
    }

    return (
        <div className="mb-28 text-slate-500">
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <h1 className="max-w-[12rem] text-2xl leading-tight sm:max-w-none sm:text-3xl">
                    Seller <span className="text-slate-800 font-medium">Dashboard</span>
                </h1>
                <div className="flex flex-wrap justify-end gap-3">
                    <Link 
                        href="/store/settings/users" 
                        className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 sm:min-h-0 sm:text-base"
                    >
                        <UserPlusIcon size={18} />
                        <span>Invite Team Members</span>
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {dashboardOverviewCards.map((card) => (
                    <div key={card.title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-xs text-slate-500 sm:text-sm">{card.title}</p>
                                <p className="mt-2 break-words text-2xl font-semibold text-slate-900 sm:text-3xl">{card.value}</p>
                            </div>
                            <div className="rounded-full bg-slate-100 p-3 text-slate-400">
                                <card.icon size={18} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                <div className="max-w-3xl">
                    <h2 className="text-xl font-semibold text-slate-900">Product Count By Date Range</h2>
                    <p className="mt-2 text-sm text-slate-500">
                        Select a start and end date-time to see how many units of each product were ordered in that period.
                    </p>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_190px_190px]">
                    <div>
                        <label className="text-sm font-medium text-slate-700">From Date & Time</label>
                        <input
                            type="datetime-local"
                            value={dateRange.from}
                            onChange={(event) => setDateRange((prev) => ({ ...prev, from: event.target.value }))}
                            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium text-slate-700">To Date & Time</label>
                        <input
                            type="datetime-local"
                            value={dateRange.to}
                            onChange={(event) => setDateRange((prev) => ({ ...prev, to: event.target.value }))}
                            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs text-slate-500">Orders In Range</p>
                        <p className="mt-2 text-3xl font-semibold text-slate-900">{dashboardData.rangeSummary?.ordersInRange ?? 0}</p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs text-slate-500">Units Sold In Range</p>
                        <p className="mt-2 text-3xl font-semibold text-slate-900">{dashboardData.rangeSummary?.unitsSoldInRange ?? 0}</p>
                    </div>
                </div>

                <p className="mt-5 text-sm text-slate-500">
                    From: <span className="font-medium text-slate-700">{formatDateTimeLabel(dashboardData.rangeSummary?.from || dateRange.from)}</span>
                    {' '}to{' '}
                    <span className="font-medium text-slate-700">{formatDateTimeLabel(dashboardData.rangeSummary?.to || dateRange.to)}</span>
                </p>

                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    {dashboardData.rangeSummary?.products?.length ? (
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {dashboardData.rangeSummary.products.map((product) => (
                                <div key={product.productId} className="rounded-xl border border-slate-200 bg-white p-4">
                                    <p className="line-clamp-2 font-medium text-slate-900">{product.name}</p>
                                    <div className="mt-3 flex items-center justify-between text-sm">
                                        <span className="text-slate-500">Units Sold</span>
                                        <span className="font-semibold text-slate-900">{product.units}</span>
                                    </div>
                                    <div className="mt-1 flex items-center justify-between text-sm">
                                        <span className="text-slate-500">Orders</span>
                                        <span className="font-semibold text-slate-900">{product.orders}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
                            No ordered products found in the selected date-time range.
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {
                    dashboardCardsData.map((card, index) => (
                        <div key={index} className="flex min-h-28 items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                            <div className="flex min-w-0 flex-col gap-2 text-xs sm:text-sm">
                                <p className="text-slate-500">{card.title}</p>
                                <b className="break-words text-2xl font-medium text-slate-700 sm:text-3xl">{card.value}</b>
                            </div>
                            <card.icon size={48} className="h-12 w-12 shrink-0 rounded-full bg-slate-100 p-3 text-slate-400" />
                        </div>
                    ))
                }
            </div>


            {/* CarouselProducts and reviews removed as requested */}
            {/* Contact Us Messages Section */}
            <ContactMessagesSeller />
        </div>
    )
}