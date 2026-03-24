'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { useAuth } from '@/lib/useAuth'
import { BellIcon, MailIcon, CheckCircleIcon, AlertCircleIcon } from 'lucide-react'

export default function ProductNotificationsPage() {
  const { getToken } = useAuth()
  const [activeTab, setActiveTab] = useState('settings') // settings, send, templates, or history
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)

  // Settings
  const [settings, setSettings] = useState({
    enableNewProductNotifications: true,
    notifyOnProductAdded: true,
  })

  // Send Email
  const [products, setProducts] = useState([])
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [customers, setCustomers] = useState([])
  const [selectedCustomers, setSelectedCustomers] = useState([])
  const [selectAll, setSelectAll] = useState(false)
  const [customMessage, setCustomMessage] = useState('')
  const [additionalEmails, setAdditionalEmails] = useState('')

  // Email History
  const [emailHistory, setEmailHistory] = useState([])
  const [historyStats, setHistoryStats] = useState({ sent: 0, failed: 0, pending: 0 })
  const [historyPage, setHistoryPage] = useState(1)
  const [historyTotal, setHistoryTotal] = useState(0)

  // Load initial data
  useEffect(() => {
    loadSettings()
    loadProducts()
    loadCustomers()
    if (activeTab === 'history') {
      loadEmailHistory()
    }
  }, [activeTab])

  const loadSettings = async () => {
    try {
      const token = await getToken()
      const { data } = await axios.get('/api/store/notification-settings', {
        headers: { Authorization: `Bearer ${token}` }
      })
      setSettings(data.settings || {})
    } catch (e) {
      console.error('Error loading settings:', e)
    }
  }

  const loadProducts = async () => {
    try {
      const token = await getToken()
      const { data } = await axios.get('/api/products?limit=1000', {
        headers: { Authorization: `Bearer ${token}` }
      })
      setProducts(data.products || [])
    } catch (e) {
      toast.error('Failed to load products')
    }
  }

  const loadCustomers = async () => {
    try {
      setLoading(true)
      const token = await getToken()
      const { data } = await axios.get('/api/store/customers', {
        headers: { Authorization: `Bearer ${token}` }
      })
      setCustomers(data.customers || [])
    } catch (e) {
      toast.error('Failed to load customers')
    } finally {
      setLoading(false)
    }
  }

  const loadEmailHistory = async (page = 1) => {
    try {
      setLoading(true)
      const token = await getToken()
      console.log('[loadEmailHistory] Fetching with token:', token ? 'Yes' : 'No')
      const { data } = await axios.get(`/api/store/email-history?page=${page}&limit=20`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      console.log('[loadEmailHistory] Data received:', data)
      setEmailHistory(data.history || [])
      setHistoryStats(data.stats || { sent: 0, failed: 0, pending: 0 })
      setHistoryTotal(data.pagination?.total || 0)
      setHistoryPage(page)
    } catch (e) {
      console.error('[loadEmailHistory] Error:', e.response?.data || e.message)
      toast.error('Failed to load email history')
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    try {
      setSending(true)
      const token = await getToken()
      await axios.put('/api/store/notification-settings', settings, {
        headers: { Authorization: `Bearer ${token}` }
      })
      toast.success('Settings saved successfully')
    } catch (e) {
      toast.error('Failed to save settings')
    } finally {
      setSending(false)
    }
  }

  const handleSelectAll = (checked) => {
    setSelectAll(checked)
    if (checked) {
      setSelectedCustomers(customers.map(c => c._id || c.email))
    } else {
      setSelectedCustomers([])
    }
  }

  const toggleCustomer = (customerId) => {
    setSelectedCustomers(prev => {
      const newList = prev.includes(customerId)
        ? prev.filter(id => id !== customerId)
        : [...prev, customerId]
      // If all customers are selected, check "Select All"
      if (newList.length === customers.length && customers.length > 0) {
        setSelectAll(true)
      } else {
        setSelectAll(false)
      }
      return newList
    })
  }

  const sendProductNotification = async () => {
    if (!selectedProduct) {
      toast.error('Please select a product')
      return
    }

    // Parse additional emails
    const emailList = additionalEmails
      .split(/[,;\n]/)
      .map(e => e.trim())
      .filter(e => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))

    if (selectedCustomers.length === 0 && emailList.length === 0) {
      toast.error('Please select at least one customer or add email addresses')
      return
    }

    try {
      setSending(true)
      const token = await getToken()
      const product = products.find(p => p._id === selectedProduct)

      await axios.post('/api/store/send-notification', {
        type: 'product',
        product: {
          id: product._id,
          slug: product.slug,
          name: product.name,
          price: product.price,
          image: product.images?.[0],
          description: product.shortDescription || product.description
        },
        customerIds: selectedCustomers,
        additionalEmails: emailList,
        customMessage: customMessage
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })

      const totalRecipients = selectedCustomers.length + emailList.length
      toast.success(`Email sent to ${totalRecipients} recipient(s)`)
      setSelectedProduct(null)
      setSelectedCustomers([])
      setSelectAll(false)
      setCustomMessage('')
      setAdditionalEmails('')
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to send emails')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className='p-6 max-w-6xl'>
      <div className='flex items-center gap-3 mb-6'>
        <BellIcon className='text-slate-700' size={32} />
        <h1 className='text-3xl font-semibold text-slate-800'>Product Notifications</h1>
      </div>

      {/* Tabs */}
      <div className='flex gap-2 mb-6 border-b border-slate-200'>
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-3 font-medium border-b-2 transition ${
            activeTab === 'settings'
              ? 'border-slate-700 text-slate-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Settings
        </button>
        <button
          onClick={() => setActiveTab('send')}
          className={`px-4 py-3 font-medium border-b-2 transition ${
            activeTab === 'send'
              ? 'border-slate-700 text-slate-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Send Email to Customers
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`px-4 py-3 font-medium border-b-2 transition ${
            activeTab === 'templates'
              ? 'border-slate-700 text-slate-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Email Templates
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-3 font-medium border-b-2 transition ${
            activeTab === 'history'
              ? 'border-slate-700 text-slate-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Email History
        </button>
      </div>

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className='bg-white p-6 rounded-xl border border-slate-200'>
          <h2 className='text-xl font-semibold text-slate-800 mb-6 flex items-center gap-2'>
            <MailIcon size={24} /> Notification Settings
          </h2>

          <div className='space-y-4'>
            <label className='flex items-center gap-3 cursor-pointer'>
              <input
                type='checkbox'
                checked={settings.enableNewProductNotifications}
                onChange={(e) => setSettings(s => ({ ...s, enableNewProductNotifications: e.target.checked }))}
                className='w-5 h-5 accent-slate-700'
              />
              <div>
                <span className='text-lg font-medium text-slate-700'>Enable Product Notifications</span>
                <p className='text-sm text-slate-500'>Allow automatic notifications when new products are added</p>
              </div>
            </label>

            <label className='flex items-center gap-3 cursor-pointer ml-8'>
              <input
                type='checkbox'
                checked={settings.notifyOnProductAdded}
                disabled={!settings.enableNewProductNotifications}
                onChange={(e) => setSettings(s => ({ ...s, notifyOnProductAdded: e.target.checked }))}
                className='w-5 h-5 accent-slate-700 disabled:opacity-50'
              />
              <div>
                <span className='text-lg font-medium text-slate-700'>Auto-send email when product added</span>
                <p className='text-sm text-slate-500'>Automatically notify all subscribed customers of new products</p>
              </div>
            </label>
          </div>

          <div className='flex justify-end mt-8'>
            <button
              onClick={saveSettings}
              disabled={sending}
              className='bg-slate-700 text-white px-6 py-3 rounded-lg hover:bg-slate-900 disabled:opacity-60 transition font-medium'
            >
              {sending ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      )}

      {/* Send Email Tab */}
      {activeTab === 'send' && (
        <div className='space-y-6'>
          {/* Select Product */}
          <div className='bg-white p-6 rounded-xl border border-slate-200'>
            <h2 className='text-xl font-semibold text-slate-800 mb-4'>Select Product</h2>
            <select
              value={selectedProduct || ''}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className='w-full border border-slate-300 rounded-lg px-4 py-3 focus:border-slate-400 focus:outline-none'
            >
              <option value=''>Choose a product...</option>
              {products.map(p => (
                <option key={p._id} value={p._id}>
                  {p.name} - AED{p.price}
                </option>
              ))}
            </select>

            {selectedProduct && (
              <div className='mt-4 p-4 bg-slate-50 rounded-lg'>
                {(() => {
                  const product = products.find(p => p._id === selectedProduct)
                  return (
                    <div className='flex gap-4'>
                      {product?.images?.[0] && (
                        <img src={product.images[0]} alt={product.name} className='w-20 h-20 object-cover rounded' />
                      )}
                      <div className='flex-1'>
                        <h3 className='font-semibold text-slate-800'>{product?.name}</h3>
                        <p className='text-sm text-slate-600 mt-1'>{product?.shortDescription}</p>
                        <p className='text-lg font-bold text-slate-800 mt-2'>AED{product?.price}</p>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}
          </div>

          {/* Custom Message */}
          <div className='bg-white p-6 rounded-xl border border-slate-200'>
            <h2 className='text-xl font-semibold text-slate-800 mb-4'>Custom Message (Optional)</h2>
            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder='Add a custom message to include in the email (e.g., "Limited time offer!" or "Just arrived in stock!")'
              className='w-full border border-slate-300 rounded-lg px-4 py-3 focus:border-slate-400 focus:outline-none'
              rows={4}
            />
            <p className='text-xs text-slate-500 mt-2'>Leave empty to use default message</p>
          </div>

          {/* Additional Email Addresses */}
          <div className='bg-white p-6 rounded-xl border border-slate-200'>
            <h2 className='text-xl font-semibold text-slate-800 mb-4'>Additional Email Addresses (Optional)</h2>
            <textarea
              value={additionalEmails}
              onChange={(e) => setAdditionalEmails(e.target.value)}
              placeholder='Enter email addresses separated by commas, semicolons, or new lines&#10;Example:&#10;customer1@example.com, customer2@example.com&#10;customer3@example.com'
              className='w-full border border-slate-300 rounded-lg px-4 py-3 focus:border-slate-400 focus:outline-none font-mono text-sm'
              rows={5}
            />
            <div className='flex items-start gap-2 mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg'>
              <AlertCircleIcon className='text-blue-600 flex-shrink-0 mt-0.5' size={16} />
              <div className='text-xs text-slate-700'>
                <p className='font-semibold mb-1'>You can add multiple emails by separating them with:</p>
                <ul className='list-disc list-inside space-y-1 ml-2'>
                  <li>Commas (,)</li>
                  <li>Semicolons (;)</li>
                  <li>New lines (press Enter)</li>
                </ul>
                <p className='mt-2'>Invalid email addresses will be automatically filtered out.</p>
              </div>
            </div>
          </div>

          {/* Select Customers */}
          <div className='bg-white p-6 rounded-xl border border-slate-200'>
            <h2 className='text-xl font-semibold text-slate-800 mb-4'>Select Customers</h2>

            {loading ? (
              <div className='text-center py-8 text-slate-500'>Loading customers...</div>
            ) : customers.length === 0 ? (
              <div className='bg-blue-50 border border-blue-200 rounded-lg p-6 text-center'>
                <AlertCircleIcon className='inline mr-2 text-blue-600' size={20} />
                <p className='text-slate-700 font-medium mb-2'>No customers found yet</p>
                <p className='text-slate-500 text-sm'>Customers will appear here once they place their first order. Start by getting your first customer to see them listed here.</p>
              </div>
            ) : (
              <>
                <div className='mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200'>
                  <label className='flex items-center gap-3 cursor-pointer'>
                    <input
                      type='checkbox'
                      checked={selectAll}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className='w-5 h-5 accent-slate-700'
                    />
                    <span className='font-semibold text-slate-800'>
                      Select All ({customers.length} customers)
                    </span>
                  </label>
                </div>

                <div className='max-h-96 overflow-y-auto space-y-2'>
                  {customers.map((customer, index) => {
                    const customerId = customer._id || customer.email || `customer-${index}`
                    return (
                      <label key={customerId} className='flex items-center gap-3 p-3 hover:bg-slate-50 rounded cursor-pointer'>
                        <input
                          type='checkbox'
                          checked={selectedCustomers.includes(customerId)}
                          onChange={() => toggleCustomer(customerId)}
                          className='w-5 h-5 accent-slate-700'
                        />
                        <div className='flex-1'>
                          <div className='font-medium text-slate-700'>{customer.name || customer.email}</div>
                          <div className='text-sm text-slate-500'>{customer.email}</div>
                        </div>
                      </label>
                    )
                  })}
                </div>

                <div className='mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-slate-700'>
                  <strong>{selectedCustomers.length}</strong> customer(s) selected
                  {additionalEmails.trim() && (() => {
                    const emailCount = additionalEmails.split(/[,;\n]/).map(e => e.trim()).filter(e => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)).length
                    return emailCount > 0 ? <span> + <strong>{emailCount}</strong> additional email(s)</span> : null
                  })()}
                </div>
              </>
            )}
          </div>

          {/* Send Button */}
          <div className='flex justify-end gap-3'>
            <button
              onClick={() => {
                setSelectedProduct(null)
                setSelectedCustomers([])
                setSelectAll(false)
                setCustomMessage('')
                setAdditionalEmails('')
              }}
              className='border border-slate-300 text-slate-700 px-6 py-3 rounded-lg hover:bg-slate-50 transition font-medium'
            >
              Clear
            </button>
            <button
              onClick={sendProductNotification}
              disabled={sending || !selectedProduct || (selectedCustomers.length === 0 && !additionalEmails.trim())}
              className='bg-slate-700 text-white px-6 py-3 rounded-lg hover:bg-slate-900 disabled:opacity-60 transition font-medium flex items-center gap-2'
            >
              <MailIcon size={18} />
              {sending ? 'Sending...' : (() => {
                const emailCount = additionalEmails.split(/[,;\n]/).map(e => e.trim()).filter(e => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)).length
                const total = selectedCustomers.length + emailCount
                return `Send to ${total} Recipient(s)`
              })()}
            </button>
          </div>
        </div>
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className='bg-white p-6 rounded-xl border border-slate-200'>
          <h2 className='text-xl font-semibold text-slate-800 mb-6 flex items-center gap-2'>
            <MailIcon size={24} /> Email Templates
          </h2>

          <div className='space-y-4'>
            <p className='text-slate-600'>
              Manage email templates for product notifications. Use the placeholders shown below in your email template.
            </p>

            <div className='bg-slate-50 border border-slate-200 rounded-lg p-4'>
              <h3 className='font-semibold text-slate-800 mb-3'>Available Placeholders:</h3>
              <ul className='grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-slate-700'>
                <li className='bg-white p-2 rounded border border-slate-200'><code className='bg-gray-100 px-2 py-1 rounded'>{'{'}{'{'}customerName{'}'}{'}' }</code> - Customer name</li>
                <li className='bg-white p-2 rounded border border-slate-200'><code className='bg-gray-100 px-2 py-1 rounded'>{'{'}{'{'}productName{'}'}{'}' }</code> - Product name</li>
                <li className='bg-white p-2 rounded border border-slate-200'><code className='bg-gray-100 px-2 py-1 rounded'>{'{'}{'{'}productPrice{'}'}{'}' }</code> - Product price</li>
                <li className='bg-white p-2 rounded border border-slate-200'><code className='bg-gray-100 px-2 py-1 rounded'>{'{'}{'{'}productImage{'}'}{'}' }</code> - Product image URL</li>
                <li className='bg-white p-2 rounded border border-slate-200'><code className='bg-gray-100 px-2 py-1 rounded'>{'{'}{'{'}productDescription{'}'}{'}' }</code> - Product description</li>
                <li className='bg-white p-2 rounded border border-slate-200'><code className='bg-gray-100 px-2 py-1 rounded'>{'{'}{'{'}customMessage{'}'}{'}' }</code> - Custom message</li>
                <li className='bg-white p-2 rounded border border-slate-200'><code className='bg-gray-100 px-2 py-1 rounded'>{'{'}{'{'}shopUrl{'}'}{'}' }</code> - Product shop link</li>
                <li className='bg-white p-2 rounded border border-slate-200'><code className='bg-gray-100 px-2 py-1 rounded'>{'{'}{'{'}preferencesUrl{'}'}{'}' }</code> - Preferences link</li>
              </ul>
            </div>

            <div className='bg-blue-50 border border-blue-200 rounded-lg p-4'>
              <p className='text-sm text-slate-700'>
                <strong>Note:</strong> The default template is used if no custom template is selected. You can create multiple templates and choose which one to use when sending notifications.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Email History Tab */}
      {activeTab === 'history' && (
        <div className='space-y-6'>
          {/* Stats Cards */}
          <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
            <div className='bg-white p-6 rounded-xl border border-slate-200'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-sm text-slate-500 mb-1'>Emails Sent</p>
                  <p className='text-3xl font-bold text-green-600'>{historyStats.sent}</p>
                </div>
                <CheckCircleIcon size={40} className='text-green-500 opacity-20' />
              </div>
            </div>
            <div className='bg-white p-6 rounded-xl border border-slate-200'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-sm text-slate-500 mb-1'>Failed</p>
                  <p className='text-3xl font-bold text-red-600'>{historyStats.failed}</p>
                </div>
                <AlertCircleIcon size={40} className='text-red-500 opacity-20' />
              </div>
            </div>
            <div className='bg-white p-6 rounded-xl border border-slate-200'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-sm text-slate-500 mb-1'>Total Emails</p>
                  <p className='text-3xl font-bold text-slate-700'>{historyTotal}</p>
                </div>
                <MailIcon size={40} className='text-slate-500 opacity-20' />
              </div>
            </div>
          </div>

          {/* Email History Table */}
          <div className='bg-white rounded-xl border border-slate-200 overflow-hidden'>
            <div className='p-6 border-b border-slate-200'>
              <h2 className='text-xl font-semibold text-slate-800 flex items-center gap-2'>
                <MailIcon size={24} /> Email History
              </h2>
            </div>

            {loading ? (
              <div className='p-8 text-center text-slate-500'>Loading email history...</div>
            ) : emailHistory.length === 0 ? (
              <div className='p-8 text-center'>
                <MailIcon className='inline mb-2 text-slate-300' size={40} />
                <p className='text-slate-500'>No emails sent yet</p>
              </div>
            ) : (
              <div className='overflow-x-auto'>
                <table className='w-full'>
                  <thead className='bg-slate-50'>
                    <tr className='border-b border-slate-200'>
                      <th className='px-6 py-3 text-left text-sm font-semibold text-slate-700'>Date</th>
                      <th className='px-6 py-3 text-left text-sm font-semibold text-slate-700'>To</th>
                      <th className='px-6 py-3 text-left text-sm font-semibold text-slate-700'>Product</th>
                      <th className='px-6 py-3 text-left text-sm font-semibold text-slate-700'>Subject</th>
                      <th className='px-6 py-3 text-left text-sm font-semibold text-slate-700'>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emailHistory.map((email, idx) => (
                      <tr key={idx} className='border-b border-slate-200 hover:bg-slate-50 transition'>
                        <td className='px-6 py-4 text-sm text-slate-600'>
                          {new Date(email.sentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className='px-6 py-4'>
                          <div>
                            <p className='text-sm font-medium text-slate-900'>{email.recipientName || 'Customer'}</p>
                            <p className='text-xs text-slate-500'>{email.recipientEmail}</p>
                          </div>
                        </td>
                        <td className='px-6 py-4 text-sm text-slate-600'>{email.productName || '-'}</td>
                        <td className='px-6 py-4'>
                          <p className='text-sm text-slate-700 truncate max-w-xs' title={email.subject}>{email.subject}</p>
                        </td>
                        <td className='px-6 py-4'>
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                            email.status === 'sent'
                              ? 'bg-green-100 text-green-800'
                              : email.status === 'failed'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {email.status === 'sent' && <CheckCircleIcon size={12} className='mr-1' />}
                            {email.status === 'failed' && <AlertCircleIcon size={12} className='mr-1' />}
                            {email.status.charAt(0).toUpperCase() + email.status.slice(1)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {!loading && emailHistory.length > 0 && (
              <div className='p-6 border-t border-slate-200 flex items-center justify-between'>
                <p className='text-sm text-slate-600'>
                  Page {historyPage} of {Math.ceil(historyTotal / 20)}
                </p>
                <div className='flex gap-2'>
                  <button
                    onClick={() => loadEmailHistory(historyPage - 1)}
                    disabled={historyPage === 1}
                    className='px-4 py-2 border border-slate-300 rounded-lg disabled:opacity-50 hover:bg-slate-50 transition text-sm font-medium'
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => loadEmailHistory(historyPage + 1)}
                    disabled={historyPage >= Math.ceil(historyTotal / 20)}
                    className='px-4 py-2 border border-slate-300 rounded-lg disabled:opacity-50 hover:bg-slate-50 transition text-sm font-medium'
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
