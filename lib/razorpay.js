import Razorpay from 'razorpay';

// Lazy instance — only created when actually called at runtime, not at build time.
let _razorpay = null;
const getRazorpay = () => {
  if (!_razorpay) {
    const key_id = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key_id || !key_secret) {
      throw new Error('Razorpay is not configured (missing NEXT_PUBLIC_RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET)');
    }
    _razorpay = new Razorpay({ key_id, key_secret });
  }
  return _razorpay;
};
// keep legacy default export compatible
const razorpay = new Proxy({}, { get: (_, prop) => getRazorpay()[prop] });

/**
 * Check Razorpay payment status and settlement details
 * @param {string} paymentId - Razorpay payment ID
 * @returns {Promise<Object>} Payment details with settlement status
 */
export async function getRazorpayPaymentStatus(paymentId) {
  try {
    const payment = await razorpay.payments.fetch(paymentId);
    
    return {
      success: true,
      payment_id: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status, // captured, failed, pending
      method: payment.method, // card, netbanking, wallet, vpa, etc.
      created_at: payment.created_at,
      captured: payment.captured,
      description: payment.description,
      email: payment.email,
      contact: payment.contact,
      
      // Settlement details
      acquirer_data: payment.acquirer_data,
      fee: payment.fee,
      tax: payment.tax,
      
      // Additional metadata from Razorpay
      notes: payment.notes,
      receipt: payment.receipt,
      
      // Derived settlement status
      is_settled: payment.status === 'captured' && payment.captured === true,
      error_reason: payment.error_reason || null
    };
  } catch (error) {
    console.error('[Razorpay Error] Failed to fetch payment:', error);
    return {
      success: false,
      error: error.message,
      payment_id: paymentId
    };
  }
}

/**
 * Get settlement details for a payment (transfers/settlements)
 * @param {string} paymentId - Razorpay payment ID
 * @returns {Promise<Object>} Settlement information
 */
export async function getRazorpaySettlement(paymentId) {
  try {
    // Fetch all transfers for this payment to check if it's been settled
    const transfers = await razorpay.transfers.all({ source: paymentId });
    
    if (transfers.items && transfers.items.length > 0) {
      const transfer = transfers.items[0];
      return {
        success: true,
        is_transferred: true,
        transfer_id: transfer.id,
        transfer_status: transfer.status, // created, processed, failed
        transferred_at: transfer.created_at,
        recipient_id: transfer.recipient_id,
        amount_transferred: transfer.amount,
        currency: transfer.currency,
        notes: transfer.notes
      };
    }
    
    return {
      success: true,
      is_transferred: false,
      transfer_id: null,
      transfer_status: null,
      message: 'Payment not yet transferred to bank account'
    };
  } catch (error) {
    console.error('[Razorpay Error] Failed to fetch settlement:', error);
    return {
      success: false,
      error: error.message,
      payment_id: paymentId
    };
  }
}

/**
 * Get refund details for a payment
 * @param {string} paymentId - Razorpay payment ID
 * @returns {Promise<Array>} List of refunds for the payment
 */
export async function getRazorpayRefunds(paymentId) {
  try {
    const refunds = await razorpay.refunds.all({ payment_id: paymentId });
    
    return {
      success: true,
      refunds: (refunds.items || []).map(r => ({
        refund_id: r.id,
        amount: r.amount,
        status: r.status,
        created_at: r.created_at,
        receipt: r.receipt,
        notes: r.notes
      })),
      total_refunded: refunds.items ? refunds.items.reduce((sum, r) => sum + r.amount, 0) : 0
    };
  } catch (error) {
    console.error('[Razorpay Error] Failed to fetch refunds:', error);
    return {
      success: false,
      error: error.message,
      payment_id: paymentId
    };
  }
}

/**
 * Comprehensive payment status check combining all details
 * @param {string} paymentId - Razorpay payment ID
 * @returns {Promise<Object>} Complete payment status including settlement
 */
export async function getCompleteRazorpayStatus(paymentId) {
  try {
    const [paymentStatus, settlement, refunds] = await Promise.all([
      getRazorpayPaymentStatus(paymentId),
      getRazorpaySettlement(paymentId),
      getRazorpayRefunds(paymentId)
    ]);

    return {
      payment: paymentStatus,
      settlement,
      refunds,
      
      // Derived overall status
      is_payment_captured: paymentStatus.success && paymentStatus.captured,
      is_transferred_to_bank: settlement.success && settlement.is_transferred,
      
      // Easy to use flags
      can_refund: paymentStatus.success && paymentStatus.captured && !refunds.total_refunded > 0,
      settlement_status: settlement.success 
        ? (settlement.is_transferred ? 'TRANSFERRED' : 'PENDING')
        : 'UNKNOWN'
    };
  } catch (error) {
    console.error('[Razorpay Error] Failed to get complete status:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Listen for Razorpay webhooks (for real-time settlement updates)
 * This function validates webhook signature
 * @param {Object} event - Webhook event from Razorpay
 * @param {string} signature - Webhook signature from header
 * @returns {boolean} Is signature valid?
 */
export function validateRazorpayWebhookSignature(event, signature) {
  try {
    const crypto = require('crypto');
    const hash = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(JSON.stringify(event))
      .digest('hex');
    
    return hash === signature;
  } catch (error) {
    console.error('[Razorpay Error] Webhook validation failed:', error);
    return false;
  }
}

export default razorpay;
