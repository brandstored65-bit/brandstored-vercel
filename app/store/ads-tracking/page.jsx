'use client';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart3, TrendingUp, Users, ShoppingCart, DollarSign, Percent } from 'lucide-react';
import { useAuth } from '@/lib/useAuth';
import Loading from '@/components/Loading';

export default function AdsTrackingPage() {
  const { getToken } = useAuth();
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, facebook, instagram, google
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchAttributionStats();
  }, [filter, dateRange]);

  const fetchAttributionStats = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      
      let url = '/api/analytics/track-attribution';
      const params = new URLSearchParams();
      
      if (dateRange.startDate) params.append('startDate', dateRange.startDate);
      if (dateRange.endDate) params.append('endDate', dateRange.endDate);
      if (filter !== 'all') params.append('source', filter);
      
      if (params.toString()) {
        url += '?' + params.toString();
      }
      
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      setStats(response.data.stats || []);
    } catch (error) {
      console.error('Error fetching attribution stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotals = () => {
    return stats.reduce(
      (acc, stat) => ({
        visits: acc.visits + (stat.totalVisits || 0),
        conversions: acc.conversions + (stat.conversions || 0),
        revenue: acc.revenue + (stat.totalConversionValue || 0),
        avgValue: acc.revenue / (acc.conversions || 1)
      }),
      { visits: 0, conversions: 0, revenue: 0, avgValue: 0 }
    );
  };

  const totals = calculateTotals();
  const overallCR = totals.visits > 0 ? ((totals.conversions / totals.visits) * 100).toFixed(2) : 0;

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">📊 Ads Tracking</h1>
          <p className="text-gray-600 mt-1">Track traffic from Facebook & Instagram ads</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Source Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Ad Source</label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Sources</option>
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
              <option value="google">Google</option>
              <option value="direct">Direct</option>
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow p-4 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">Total Visits</p>
              <p className="text-2xl font-bold text-blue-900 mt-1">{totals.visits.toLocaleString()}</p>
            </div>
            <Users className="w-8 h-8 text-blue-400" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg shadow p-4 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">Conversions</p>
              <p className="text-2xl font-bold text-green-900 mt-1">{totals.conversions.toLocaleString()}</p>
            </div>
            <ShoppingCart className="w-8 h-8 text-green-400" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg shadow p-4 border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600">Conv. Rate</p>
              <p className="text-2xl font-bold text-purple-900 mt-1">{overallCR}%</p>
            </div>
            <Percent className="w-8 h-8 text-purple-400" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg shadow p-4 border border-amber-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-amber-600">Total Revenue</p>
              <p className="text-2xl font-bold text-amber-900 mt-1">AED{totals.revenue.toLocaleString()}</p>
            </div>
            <DollarSign className="w-8 h-8 text-amber-400" />
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Campaign Performance</h2>
        </div>

        {stats.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <BarChart3 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No data available for the selected filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  <th className="px-6 py-3 text-left">Campaign</th>
                  <th className="px-6 py-3 text-left">Source</th>
                  <th className="px-6 py-3 text-right">Visits</th>
                  <th className="px-6 py-3 text-right">Conversions</th>
                  <th className="px-6 py-3 text-right">Conv. Rate</th>
                  <th className="px-6 py-3 text-right">Revenue</th>
                  <th className="px-6 py-3 text-right">Avg. Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stats.map((stat, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-3 text-sm font-medium text-gray-900">
                      {stat._id?.campaign || 'Direct'}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                        {stat._id?.source || 'direct'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm text-right font-medium text-gray-900">
                      {stat.totalVisits?.toLocaleString()}
                    </td>
                    <td className="px-6 py-3 text-sm text-right font-medium text-green-600">
                      {stat.conversions?.toLocaleString()}
                    </td>
                    <td className="px-6 py-3 text-sm text-right font-medium text-purple-600">
                      {stat.conversionRate?.toFixed(2)}%
                    </td>
                    <td className="px-6 py-3 text-sm text-right font-medium text-amber-600">
                      AED{stat.totalConversionValue?.toLocaleString()}
                    </td>
                    <td className="px-6 py-3 text-sm text-right font-medium text-gray-900">
                      AED{stat.avgValue?.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border-l-4 border-blue-500 rounded p-4">
        <h3 className="font-semibold text-blue-900 mb-2">📝 How to Use</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>✓ Add UTM parameters to your Facebook/Instagram ad URLs</li>
          <li>✓ Example: <code className="bg-white px-2 py-1 rounded">?utm_source=facebook&utm_campaign=summer_sale</code></li>
          <li>✓ Data updates in real-time as customers click ads and make purchases</li>
          <li>✓ Use filters to drill down by source, medium, or date range</li>
        </ul>
      </div>
    </div>
  );
}
