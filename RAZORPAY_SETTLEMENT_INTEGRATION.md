# Razorpay Payment Settlement Integration

## Overview

The application now automatically tracks and updates Razorpay card payment settlement status. When a customer pays via card (Razorpay), the system:

1. **Captures Payment** - Money is captured from customer's bank/card
2. **Tracks Settlement** - Monitors when amount is transferred to merchant bank account
3. **Auto-Updates Orders** - Marks orders as PAID when payment is captured
4. **Real-Time Webhooks** - Receives live updates from Razorpay about settlements

## Features Implemented

### 1. **Payment Capture Tracking**
- Captures amount from customer's payment method (credit/debit card, net banking, etc.)
- Stores payment ID and method in order
- Automatically marks order as PAID when captured
- Calculates and stores processing fees

### 2. **Settlement Monitoring**
- Tracks when Razorpay transfers amount to merchant bank account
- Stores transfer ID and transfer date
- Shows "Transferred to Bank" status in admin dashboard
- Records exact amount transferred (after deductions)

### 3. **Real-Time Webhooks**
- Receives live payment and settlement events from Razorpay
- Auto-updates orders when:
  - `payment.captured` - Payment successfully captured
  - `payment.failed` - Payment failed
  - `transfer.created` - Amount transferred to bank
  - `settlement.processed` - Settlement completed

### 4. **Admin Dashboard**
- "Check Settlement Status" button for each card payment order
- Shows current status: Captured / Pending Transfer / Transferred
- Displays payment ID, amount, and fees
- Shows bank transfer details when available

## Data Model Updates

### Order Model Extensions

```javascript
// Razorpay Payment Fields
razorpayPaymentId: String        // Razorpay payment ID (if card payment)
razorpayOrderId: String          // Razorpay order ID
razorpaySignature: String        // Webhook signature for verification

// Settlement Details
razorpaySettlement: {
  paymentId: String,             // Payment ID
  status: String,                // TRANSFERRED | PENDING | FAILED
  captured_at: Date,             // When payment was captured
  amount: Number,                // Amount captured (AED)
  fee: Number,                   // Processing fee (AED)
  is_transferred: Boolean,       // Is transferred to bank?
  transferred_at: Date,          // When transferred to bank
  transfer_id: String,           // Razorpay transfer ID
  amount_transferred: Number,    // Amount that reached bank (AED)
  recipient_id: String           // Bank account ID
}
```

## API Endpoints

### 1. **Check Payment Settlement (Customer)**
```
GET /api/orders/check-razorpay-settlement?orderId=xxx
Headers: Authorization: Bearer {token}

Response:
{
  success: true,
  order: {
    _id: "...",
    isPaid: true,
    paymentStatus: "CAPTURED",
    razorpayPaymentId: "pay_xxx"
  },
  razorpayStatus: {
    payment_captured: true,
    transferred_to_bank: true,
    settlement_status: "TRANSFERRED",
    amount: 5000,
    currency: "INR",
    fee: 300,
    transfer_details: {
      transfer_id: "trf_xxx",
      transferred_at: "2024-01-15T10:30:00.000Z",
      amount_transferred: 4700
    }
  }
}
```

### 2. **Check Payment Settlement (Store Admin)**
```
GET /api/store/orders/check-razorpay-settlement?orderId=xxx
Headers: Authorization: Bearer {token}

Response: (same as above, but with seller authorization)
```

### 3. **Razorpay Webhook Handler**
```
POST /api/webhooks/razorpay
Headers: x-razorpay-signature: {signature}

Handles Events:
- payment.captured
- payment.authorized
- payment.failed
- settlement.processed
- transfer.created
```

## How It Works

### Payment Capture Flow

```
Customer pays with card
    ↓
Razorpay captures payment
    ↓
[Webhook] payment.captured event
    ↓
API automatically:
  1. Marks order.isPaid = true
  2. Sets paymentStatus = "CAPTURED"
  3. Stores settlement.captured_at
  4. Stores fee information
    ↓
Admin dashboard shows payment captured
```

### Settlement Transfer Flow

```
Payment captured on customer's card
    ↓
T+1-2 days: Razorpay initiates settlement
    ↓
[Webhook] transfer.created event
    ↓
API automatically:
  1. Sets settlement.is_transferred = true
  2. Stores transfer ID
  3. Records transferred_at timestamp
  4. Stores recipient_id (bank account)
    ↓
Admin dashboard shows "✓ Transferred to Bank"
    ↓
Amount reaches merchant bank account
```

### Manual Check Flow

```
Admin clicks "Check Settlement Status" button
    ↓
Calls /api/store/orders/check-razorpay-settlement
    ↓
Backend fetches from Razorpay API:
  1. Payment status
  2. Transfer status
  3. Refund status
    ↓
Updates local database with latest info
    ↓
Shows status toast to admin with:
  - Payment amount
  - Processing fees
  - Transfer status
  - Transfer date/ID
```

## Files Created/Modified

### Created Files
1. **lib/razorpay.js**
   - Helper functions for Razorpay API
   - `getRazorpayPaymentStatus()` - Check payment status
   - `getRazorpaySettlement()` - Check settlement details
   - `getCompleteRazorpayStatus()` - Comprehensive status check
   - `validateRazorpayWebhookSignature()` - Webhook verification

2. **app/api/orders/check-razorpay-settlement/route.js**
   - Customer endpoint to check their payment settlement
   - Auto-marks order as PAID if payment captured

3. **app/api/store/orders/check-razorpay-settlement/route.js**
   - Admin endpoint to check customer's payment settlement
   - Seller authorization required
   - Stores settlement details in database

4. **app/api/webhooks/razorpay/route.js**
   - Webhook receiver for real-time Razorpay events
   - Handles: payment.captured, payment.failed, transfer.created
   - Auto-updates order settlement status

### Modified Files
1. **models/Order.js**
   - Added `razorpayPaymentId` field
   - Added `razorpayOrderId` field
   - Added `razorpaySignature` field
   - Added `razorpaySettlement` object with settlement schema

2. **app/store/orders/page.jsx**
   - Added `checkRazorpaySettlement()` function
   - Added Razorpay payment info box in modal
   - Added "Check Settlement Status" button
   - Shows transfer status with pending/completed indicator

## Razorpay API Fields Used

All fields come from Razorpay's v1 API documentation:

### Payment Object
```javascript
{
  id: "pay_xxx",           // Payment ID
  entity: "payment",
  amount: 500000,          // In paise (AED5000)
  currency: "INR",
  status: "captured",      // captured | failed | pending
  method: "card",          // card | netbanking | wallet | vpa
  captured: true,          // Has payment been captured?
  created_at: 1640xxx,     // Unix timestamp
  fee: 29700,              // In paise
  tax: 2970,               // In paise
}
```

### Transfer Object
```javascript
{
  id: "trf_xxx",
  entity: "transfer",
  source: "pay_xxx",       // Linked payment ID
  recipient: "racc_xxx",   // Bank account ID
  amount: 470300,          // In paise (after deduction)
  currency: "INR",
  status: "processed",     // created | processed | failed
  created_at: 1641xxx
}
```

## Webhook Events

### payment.captured
```javascript
{
  event: "payment.captured",
  payload: {
    payment: {
      id: "pay_xxx",
      amount: 500000,
      currency: "INR",
      status: "captured",
      method: "card",
      fee: 29700
    }
  }
}
```

Triggers:
- Auto-mark order as isPaid = true
- Store captured_at and fee information
- Update paymentStatus to "CAPTURED"

### payment.failed
```javascript
{
  event: "payment.failed",
  payload: {
    payment: {
      id: "pay_xxx",
      error_reason: "insufficient_funds"
    }
  }
}
```

Triggers:
- Mark order isPaid = false
- Set paymentStatus = "FAILED"
- Store error reason in order notes

### transfer.created
```javascript
{
  event: "transfer.created",
  payload: {
    transfer: {
      id: "trf_xxx",
      source: "pay_xxx",
      amount: 470300,
      recipient_id: "racc_xxx"
    }
  }
}
```

Triggers:
- Update settlement.is_transferred = true
- Store transfer_id and transferred_at
- Update settlement status to "TRANSFERRED"

## Admin Features

### Settlement Status Display
In `/store/orders` modal for card payments:

```
💳 Card Payment (Razorpay)
Payment ID: end (last 8 chars)
✓ Transferred to Bank Account        [if transferred]
⏳ Pending transfer to bank           [if not transferred]
[Check Settlement Status] button
```

### Check Settlement Flow
1. Admin clicks "Check Settlement Status"
2. System fetches latest from Razorpay API
3. Database is updated if new info found
4. Toast shows:
   - Amount captured
   - Processing fee
   - Settlement status
   - Transfer ID (if transferred)
   - Amount reached bank

## Testing the Integration

### Manual Testing (Without Webhook)
1. Create order with card payment
2. Complete payment through Razorpay
3. Go to store admin orders page
4. Open order modal
5. Click "Check Settlement Status"
6. Should show:
   - ✓ Payment captured
   - Transfer status (pending or completed)

### With Test Razorpay Account
- Use Razorpay test API keys from dashboard
- Test card: 4111111111111111
- Wait 2-3 minutes for settlement
- Check webhook delivery in Razorpay dashboard

### Webhook Testing
1. Set webhook URL in Razorpay dashboard:
   - `https://yourdomain.com/api/webhooks/razorpay`
2. Trigger test events from Razorpay dashboard
3. Monitor API logs for webhook processing
4. Verify order status updates automatically

## Troubleshooting

### "Payment captured but order still shows Pending"
- Check if razorpayPaymentId is stored in order
- Verify webhook was received: Check API logs
- Click "Check Settlement Status" to sync manually

### Webhook not triggering
1. Verify webhook URL is accessible
2. Check webhook secret matches RAZORPAY_KEY_SECRET
3. Verify signature validation: `hash == signature`
4. Check Razorpay dashboard for webhook delivery logs

### Transfer pending for too long
- Settlements typically take T+1 to T+2 days
- Check Razorpay dashboard for settlement batches
- Very large amounts might take longer

## Security

### Webhook Validation
- All webhooks verified using HMAC-SHA256
- Uses RAZORPAY_KEY_SECRET from environment
- Signature in header: `x-razorpay-signature`
- Invalid signatures rejected with 401

### Data Protection
- Payment ID stored but not full payment details
- Sensitive card info never stored
- Uses Razorpay's PCI DSS compliant platform
- Settlement amounts encrypted in database

## Configuration

Required environment variables (already set):
```
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_xxx
RAZORPAY_KEY_SECRET=xxx
```

Optional configuration:
```
RAZORPAY_MERCHANT_ID=xxx  (if using transfers API)
```

## Future Enhancements

1. **Automatic Refund Processing**
   - Auto-refund cancelled orders
   - Track refund status via webhooks

2. **Payment Analytics Dashboard**
   - Track settlement success rate
   - Monitor processing fees
   - Revenue by payment method

3. **Settlement Batch Reports**
   - Daily/weekly settlement summaries
   - Export settlement data to accounting software

4. **Partial Payment Support**
   - Allow customers to pay installments
   - Track each installment separately

5. **Subscription Billing**
   - Recurring charges for subscriptions
   - Automatic renewal with Razorpay

## API Rate Limits

- Razorpay API: 100 requests per second
- Check settlement: No rate limit (internal)
- Webhook delivery: Automatic (1+ retries)

---

**Last Updated:** February 10, 2026
**Status:** ✅ Fully Implemented
**Live:** Yes (with Razorpay webhooks)
