"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useAuth } from "@/lib/useAuth";
import Loading from "@/components/Loading";
import { Users, MousePointerClick, ShoppingCart, Trophy, X } from "lucide-react";

const RANGE_OPTIONS = [1, 7, 30, 90];

function formatDuration(ms) {
  const value = Number(ms || 0);
  if (!Number.isFinite(value) || value <= 0) return "0s";
  const totalSeconds = Math.round(value / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function StoreCustomerTrackingPage() {
  const PAGE_SIZE_OPTIONS = [25, 50, 75];
  const { user, loading: authLoading, getToken } = useAuth();
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [activeCustomerKey, setActiveCustomerKey] = useState("");
  const [modalLoading, setModalLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const loadData = async (opts = {}) => {
    if (!user) return;
    const { daysValue = days, customerKey = "", modal = false } = opts;

    if (modal) {
      setModalLoading(true);
    } else {
      setLoading(true);
    }

    setError("");
    try {
      const token = await getToken();
      const params = new URLSearchParams({ days: String(daysValue) });
      if (customerKey) params.set("customerKey", customerKey);

      const res = await axios.get(`/api/store/customer-tracking?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setData(res.data);
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to load tracking data");
    } finally {
      if (modal) {
        setModalLoading(false);
      } else {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!authLoading && user) {
      loadData({ daysValue: days });
    }
    if (!authLoading && !user) {
      setLoading(false);
    }
  }, [authLoading, user, days]);

  const cards = useMemo(() => {
    const overview = data?.overview || {};
    return [
      { title: "Unique Customers", value: overview.uniqueCustomers || 0, icon: Users },
      { title: "Total Events", value: overview.totalEvents || 0, icon: MousePointerClick },
      { title: "Checkout Intent", value: overview.checkoutIntent || 0, icon: ShoppingCart },
      { title: "Conversions", value: overview.conversions || 0, icon: Trophy },
    ];
  }, [data]);

  const customers = data?.customers || [];
  const totalPages = Math.max(1, Math.ceil(customers.length / pageSize));
  const pageStartIndex = (currentPage - 1) * pageSize;
  const paginatedCustomers = customers.slice(pageStartIndex, pageStartIndex + pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [days, data?.customers?.length, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const openCustomer = async (key) => {
    setActiveCustomerKey(key);
    await loadData({ daysValue: days, customerKey: key, modal: true });
  };

  if (authLoading || loading) return <Loading />;

  if (!user) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-slate-500">
        Please login to view customer tracking.
      </div>
    );
  }

  return (
    <div className="pb-20 text-slate-700">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Customer Tracking</h1>
          <p className="text-sm text-slate-500">Source to product activity to checkout to order journey</p>
        </div>
        <div className="flex items-center gap-2">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option}
              onClick={() => setDays(option)}
              className={`px-3 py-1.5 rounded-lg text-sm border ${
                days === option
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
              }`}
            >
              {option}d
            </button>
          ))}
        </div>
      </div>

      {error && <div className="mb-4 text-sm text-red-600">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {cards.map((card) => (
          <div key={card.title} className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">{card.title}</p>
              <card.icon size={18} className="text-slate-400" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h2 className="font-semibold mb-3">Source Breakdown</h2>
          <div className="space-y-2 text-sm">
            {(data?.sourceBreakdown || []).map((item) => (
              <div key={item.source} className="flex justify-between">
                <span className="text-slate-600">{item.source || "direct"}</span>
                <span className="font-medium">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h2 className="font-semibold mb-3">Event Breakdown</h2>
          <div className="space-y-2 text-sm">
            {(data?.eventBreakdown || []).map((item) => (
              <div key={item.eventType} className="flex justify-between">
                <span className="text-slate-600">{item.eventType}</span>
                <span className="font-medium">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h2 className="font-semibold mb-3">Top Products</h2>
          <div className="space-y-2 text-sm">
            {(data?.topProducts || []).map((item) => (
              <div key={item.productId} className="flex justify-between gap-3">
                <span className="text-slate-600 truncate">{item.productName || item.productId}</span>
                <span className="font-medium">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 font-semibold">Customers</div>
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-4 py-2">Customer</th>
                <th className="text-left px-4 py-2">Type</th>
                <th className="text-left px-4 py-2">Identifier</th>
                <th className="text-left px-4 py-2">Purchased</th>
                <th className="text-left px-4 py-2">Events</th>
                <th className="text-left px-4 py-2">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {paginatedCustomers.map((row) => (
                <tr
                  key={row.customerKey}
                  onClick={() => openCustomer(row.customerKey)}
                  className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                >
                  <td className="px-4 py-2">{row.customerName || "Unknown"}</td>
                  <td className="px-4 py-2">{row.customerType || "anonymous"}</td>
                  <td className="px-4 py-2">{row.customerEmail || row.customerPhone || row.userId || row.customerKey}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        row.purchased
                          ? "bg-green-100 text-green-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {row.purchased ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="px-4 py-2">{row.eventCount}</td>
                  <td className="px-4 py-2">{formatDateTime(row.lastEventAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-600">
            Showing <span className="font-semibold text-slate-900">{customers.length === 0 ? 0 : pageStartIndex + 1}</span>
            {' '}-{' '}
            <span className="font-semibold text-slate-900">{Math.min(pageStartIndex + paginatedCustomers.length, customers.length)}</span>
            {' '}of <span className="font-semibold text-slate-900">{customers.length}</span> customers
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <span>Per page</span>
              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
              >
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
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
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {activeCustomerKey && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-5xl max-h-[90vh] rounded-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Customer Journey</h3>
              <button
                onClick={() => setActiveCustomerKey("")}
                className="p-1 rounded hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              {modalLoading ? (
                <p className="text-sm text-slate-500">Loading timeline...</p>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div className="border border-slate-200 rounded-lg p-3">
                      <p className="text-xs text-slate-500">Name</p>
                      <p className="font-medium">{data?.customerDetail?.summary?.customerName || "-"}</p>
                    </div>
                    <div className="border border-slate-200 rounded-lg p-3">
                      <p className="text-xs text-slate-500">Identifier</p>
                      <p className="font-medium break-all">{data?.customerDetail?.summary?.identifier || activeCustomerKey}</p>
                    </div>
                    <div className="border border-slate-200 rounded-lg p-3">
                      <p className="text-xs text-slate-500">Email</p>
                      <p className="font-medium">{data?.customerDetail?.summary?.customerEmail || "-"}</p>
                    </div>
                    <div className="border border-slate-200 rounded-lg p-3">
                      <p className="text-xs text-slate-500">Phone</p>
                      <p className="font-medium">{data?.customerDetail?.summary?.customerPhone || "-"}</p>
                    </div>
                    <div className="border border-slate-200 rounded-lg p-3">
                      <p className="text-xs text-slate-500">Total Time Spent</p>
                      <p className="font-medium">{formatDuration(data?.customerDetail?.totalJourneyDurationMs || 0)}</p>
                    </div>
                    <div className="border border-slate-200 rounded-lg p-3">
                      <p className="text-xs text-slate-500">Purchased</p>
                      <p className="font-medium">
                        {data?.customerDetail?.summary?.purchased ? "Yes" : "No"}
                        {Number(data?.customerDetail?.summary?.totalOrdersPlaced || 0) > 0
                          ? ` (${data?.customerDetail?.summary?.totalOrdersPlaced} order)`
                          : ""}
                      </p>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-sm font-medium">Time Spent Per Action</div>
                    <div className="max-h-[220px] overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-white sticky top-0 border-b border-slate-200">
                          <tr>
                            <th className="text-left px-3 py-2">Action</th>
                            <th className="text-left px-3 py-2">Events</th>
                            <th className="text-left px-3 py-2">Total</th>
                            <th className="text-left px-3 py-2">Avg</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(data?.customerDetail?.actionTimeSpent || []).map((row) => (
                            <tr key={row.action} className="border-t border-slate-100">
                              <td className="px-3 py-2">{row.action}</td>
                              <td className="px-3 py-2">{row.events}</td>
                              <td className="px-3 py-2">{formatDuration(row.totalDurationMs)}</td>
                              <td className="px-3 py-2">{formatDuration(row.avgDurationMs)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-sm font-medium">Timeline</div>
                    <div className="max-h-[320px] overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-white sticky top-0 border-b border-slate-200">
                          <tr>
                            <th className="text-left px-3 py-2">Time</th>
                            <th className="text-left px-3 py-2">Event</th>
                            <th className="text-left px-3 py-2">Page</th>
                            <th className="text-left px-3 py-2">Product</th>
                            <th className="text-left px-3 py-2">Action</th>
                            <th className="text-left px-3 py-2">Time Spent</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(data?.customerDetail?.timeline || []).map((event, idx) => (
                            <tr key={`${event.eventAt}-${idx}`} className="border-t border-slate-100">
                              <td className="px-3 py-2">{formatDateTime(event.eventAt)}</td>
                              <td className="px-3 py-2">{event.eventType}</td>
                              <td className="px-3 py-2">{event.pagePath || "-"}</td>
                              <td className="px-3 py-2">{event.productName || "-"}</td>
                              <td className="px-3 py-2">{event.nextAction || event.orderId || "-"}</td>
                              <td className="px-3 py-2">{formatDuration(event.actionSpentMs || event.durationMs || 0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-lg p-3">
                    <p className="text-sm font-medium mb-2">Step-by-step Journey</p>
                    <div className="space-y-2 text-sm">
                      {(data?.customerDetail?.steps || []).map((step, idx) => (
                        <div key={`${step.at}-${idx}`} className="flex gap-3">
                          <span className="text-slate-400 w-16 flex-shrink-0">#{idx + 1}</span>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-800">{step.label}</p>
                            <p className="text-slate-500">
                              {step.pagePath || "-"}
                              {step.productName ? ` | ${step.productName}` : ""}
                              {step.orderId ? ` | order: ${step.orderId}` : ""}
                              {` | time: ${formatDuration(step.actionSpentMs || 0)}`}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
