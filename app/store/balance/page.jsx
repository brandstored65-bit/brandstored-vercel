'use client'

import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import Loading from '@/components/Loading'
import { useAuth } from '@/lib/useAuth'

const PROVIDERS = [
    { id: 'razorpay', label: 'Razorpay' },
    { id: 'delhivery', label: 'Delhivery' }
]

const formatAmount = (amount, currencySymbol) => {
    const value = Number(amount || 0)
    return `${currencySymbol}${value.toFixed(2)}`
}

export default function StoreBalancePage() {
    const { user, loading: authLoading, getToken } = useAuth()
    const currencySymbol = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || 'AED'
    const [activeProvider, setActiveProvider] = useState('razorpay')
    const [initialLoading, setInitialLoading] = useState(true)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [balanceData, setBalanceData] = useState(null)

    const providerLabel = useMemo(() => {
        return PROVIDERS.find((provider) => provider.id === activeProvider)?.label || 'Balance'
    }, [activeProvider])

    useEffect(() => {
        const fetchBalance = async () => {
            if (!user) {
                setInitialLoading(false)
                return
            }

            setLoading(true)
            setError('')

            try {
                const token = await getToken()
                const { data } = await axios.get(`/api/store/balance/${activeProvider}`, {
                    headers: { Authorization: `Bearer ${token}` },
                    timeout: 10000
                })
                setBalanceData(data)
            } catch (fetchError) {
                console.error('[STORE BALANCE] Fetch error:', fetchError)
                setError(fetchError?.response?.data?.error || 'Failed to load balance data')
            } finally {
                setLoading(false)
                setInitialLoading(false)
            }
        }

        if (!authLoading) {
            fetchBalance()
        }
    }, [activeProvider, authLoading, getToken, user])

    if (authLoading || initialLoading) {
        return <Loading />
    }

    if (!user) {
        return (
            <div className="min-h-[70vh] flex items-center justify-center text-slate-500">
                <h1 className="text-2xl font-semibold">Please sign in to view balance details</h1>
            </div>
        )
    }

    return (
        <div className="mb-24">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-800">Balance</h1>
                    <p className="text-sm text-slate-500">View available balance and recent transactions.</p>
                </div>
                <div className="flex items-center gap-3">
                    {loading && (
                        <span className="text-xs text-slate-500">Refreshing...</span>
                    )}
                    <div className="flex items-center gap-2 rounded-full bg-slate-100 p-1">
                    {PROVIDERS.map((provider) => (
                        <button
                            key={provider.id}
                            onClick={() => setActiveProvider(provider.id)}
                            className={`px-4 py-2 text-sm font-semibold rounded-full transition ${
                                activeProvider === provider.id
                                    ? 'bg-white text-slate-900 shadow'
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            {provider.label}
                        </button>
                    ))}
                    </div>
                </div>
            </div>

            {error && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between gap-4">
                    <span>{error}</span>
                    <button
                        onClick={() => setActiveProvider((prev) => prev)}
                        className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700"
                    >
                        Retry
                    </button>
                </div>
            )}

            <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-slate-400">{providerLabel} balance</p>
                    <p className="mt-2 text-3xl font-semibold text-slate-900">
                        {formatAmount(balanceData?.balance?.amount || 0, currencySymbol)}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                        {balanceData?.balance?.label || 'Available balance'}
                    </p>
                    {balanceData?.balance?.lastUpdated && (
                        <p className="mt-4 text-xs text-slate-400">
                            Last updated: {new Date(balanceData.balance.lastUpdated).toLocaleString()}
                        </p>
                    )}
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-slate-400">Summary</p>
                    <div className="mt-4 space-y-3 text-sm text-slate-600">
                        <div className="flex items-center justify-between">
                            <span>Total transactions</span>
                            <span className="font-semibold text-slate-800">{balanceData?.transactions?.length || 0}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span>Provider</span>
                            <span className="font-semibold text-slate-800">{providerLabel}</span>
                        </div>
                        {balanceData?.note && (
                            <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                                {balanceData.note}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="mt-8 rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-6 py-4">
                    <h2 className="text-lg font-semibold text-slate-800">Last 20 transactions</h2>
                    <p className="text-sm text-slate-500">Most recent activity for {providerLabel}.</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                            <tr>
                                <th className="px-6 py-3 text-left font-semibold">Reference</th>
                                <th className="px-6 py-3 text-left font-semibold">Status</th>
                                <th className="px-6 py-3 text-left font-semibold">Date</th>
                                <th className="px-6 py-3 text-right font-semibold">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {(balanceData?.transactions || []).map((transaction) => (
                                <tr key={transaction.id}>
                                    <td className="px-6 py-3 text-slate-800">
                                        <div className="font-medium">{transaction.reference}</div>
                                        {transaction.secondary && (
                                            <div className="text-xs text-slate-400">{transaction.secondary}</div>
                                        )}
                                    </td>
                                    <td className="px-6 py-3">
                                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                                            {transaction.status || 'Pending'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3 text-slate-500">
                                        {transaction.created_at
                                            ? new Date(transaction.created_at).toLocaleString()
                                            : 'NA'}
                                    </td>
                                    <td className="px-6 py-3 text-right font-semibold text-slate-800">
                                        {formatAmount(transaction.amount, currencySymbol)}
                                    </td>
                                </tr>
                            ))}
                            {(balanceData?.transactions || []).length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-10 text-center text-slate-400">
                                        No transactions found for {providerLabel}.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
