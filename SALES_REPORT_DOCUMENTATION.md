# Sales Report & Profit Analysis System

## 📊 Overview

A comprehensive profit/loss tracking system for your e-commerce store that calculates accurate profitability metrics by considering:
- Product actual costs (cost price)
- Selling prices
- Delivery charges
- Marketing expenses (optional)
- Order-level and monthly profit/loss analysis

## 🎯 Features

### 1. **Sales Report Dashboard** (`/store/sales-report`)
- **Real-time Metrics**
  - Total Revenue
  - Total Costs (Product + Delivery + Marketing)
  - Total Profit/Loss with margin percentage
  - Average Order Value & Average Profit

- **Date Range Filters**
  - Today, Yesterday
  - This Week, Last Week
  - This Month, Last Month
  - This Year, Last Year
  - Custom Date Range

- **Order-wise Analysis**
  - Detailed breakdown of each order
  - Revenue vs Costs comparison
  - Individual order profit/loss
  - Status tracking

- **Monthly Breakdown**
  - Month-by-month performance
  - Orders count per month
  - Revenue and profit trends

- **Marketing Analytics** (Optional)
  - Total marketing spend tracking
  - Cost per order calculation
  - ROAS (Return on Ad Spend) metrics

- **Export Functionality**
  - Download reports as CSV
  - Complete order data export
  - Easy analysis in Excel/Google Sheets

### 2. **Product Pricing Manager** (`/store/sales-report/product-pricing`)
- **Product Cost Management**
  - View all products with their selling prices
  - Add/edit actual cost prices
  - Visual profit margin indicators
  - Quick inline editing

- **Search & Filter**
  - Search by product name or SKU
  - Real-time filtering

- **Profit Margin Calculation**
  - Automatic margin calculation
  - Visual indicators (green for profit, red for loss)
  - Percentage-based margin display

- **Product Information**
  - Product images
  - SKU tracking
  - Stock status
  - Selling price vs cost price comparison

- **Summary Cards**
  - Total products count
  - Products with cost price configured
  - Products needing configuration

## 🏗️ Architecture

### Database Schema

#### Product Model (Updated)
```javascript
{
  name: String,
  sku: String,
  price: Number,              // Selling price
  AED: Number,                // AED
  costPrice: Number,          // NEW: Actual cost/purchase price
  images: [String],
  inStock: Boolean,
  // ... other fields
}
```

#### Order Model (Existing)
```javascript
{
  shortOrderNumber: Number,
  total: Number,              // Total revenue
  shippingFee: Number,        // Delivery cost
  orderItems: [{
    productId: ObjectId,
    quantity: Number,
    price: Number
  }],
  status: String,
  createdAt: Date,
  // ... other fields
}
```

### API Endpoints

#### 1. `/api/store/sales-report` (GET)
**Purpose:** Generate comprehensive sales report with profit/loss analysis

**Query Parameters:**
- `dateRange`: TODAY, YESTERDAY, THIS_WEEK, LAST_WEEK, THIS_MONTH, LAST_MONTH, THIS_YEAR, LAST_YEAR, CUSTOM
- `fromDate`: Start date (for CUSTOM range)
- `toDate`: End date (for CUSTOM range)

**Response:**
```json
{
  "success": true,
  "report": {
    "totalRevenue": 150000,
    "totalCosts": 120000,
    "productCosts": 100000,
    "deliveryCosts": 20000,
    "marketingCosts": 0,
    "totalProfit": 30000,
    "profitMargin": 20,
    "totalOrders": 50,
    "avgOrderValue": 3000,
    "avgProfit": 600,
    "monthlyData": [...]
  },
  "orders": [...]
}
```

**Calculation Logic:**
```
For each order:
  orderProfit = orderRevenue - orderProductCost - orderDeliveryCost
  
  where:
  - orderRevenue = order.total
  - orderProductCost = Σ(product.costPrice × item.quantity)
  - orderDeliveryCost = order.shippingFee

totalProfit = totalRevenue - (totalProductCosts + totalDeliveryCosts + totalMarketingCosts)
profitMargin = (totalProfit / totalRevenue) × 100
```

#### 2. `/api/store/products/pricing` (GET)
**Purpose:** Fetch all products with pricing information

**Response:**
```json
{
  "success": true,
  "products": [{
    "_id": "...",
    "name": "Product Name",
    "sku": "SKU123",
    "price": 999,
    "AED": 1499,
    "costPrice": 500,
    "images": [...],
    "inStock": true
  }]
}
```

#### 3. `/api/store/products/pricing` (PUT)
**Purpose:** Update cost price for a product

**Request Body:**
```json
{
  "productId": "product_id_here",
  "costPrice": 500
}
```

**Response:**
```json
{
  "success": true,
  "message": "Cost price updated successfully",
  "product": {
    "_id": "...",
    "name": "Product Name",
    "costPrice": 500,
    "price": 999
  }
}
```

#### 4. `/api/store/sales-report/export` (GET)
**Purpose:** Export sales report as CSV

**Query Parameters:** Same as sales-report endpoint

**Response:** CSV file download with columns:
- Order Number
- Date
- Revenue
- Product Cost
- Delivery Cost
- Profit/Loss
- Status

## 🚀 Usage Guide

### Step 1: Configure Product Cost Prices

1. Navigate to **Sales Report** from the sidebar
2. Click **Product Pricing** button
3. Find each product and click the **Edit** icon
4. Enter the actual cost price (what you paid to purchase/manufacture)
5. Click **Save** (checkmark icon)
6. Repeat for all products

**💡 Tip:** Start with your best-selling products first for accurate profit tracking.

### Step 2: View Sales Report

1. Navigate to **Sales Report** from the sidebar
2. Select desired date range from the dropdown
3. View summary cards showing:
   - Total Revenue
   - Total Costs
   - Profit/Loss
   - Average metrics
4. Scroll down for order-wise breakdown
5. Check monthly performance trends

### Step 3: Export Data

1. On the Sales Report page, click **Export CSV**
2. Open the downloaded file in Excel/Google Sheets
3. Analyze data, create charts, or share with stakeholders

## 📈 Profit Calculation Examples

### Example 1: Profitable Order
```
Product A:
  Selling Price: AED999
  Cost Price: AED500
  Quantity: 2
  
Order Details:
  Product Revenue: AED999 × 2 = AED1,998
  Product Cost: AED500 × 2 = AED1,000
  Delivery Charge: AED50
  
Profit Calculation:
  Profit = AED1,998 - AED1,000 - AED50 = AED948
  Margin = (AED948 / AED1,998) × 100 = 47.4%
```

### Example 2: Loss-Making Order
```
Product B:
  Selling Price: AED299
  Cost Price: AED250
  Quantity: 1
  
Order Details:
  Product Revenue: AED299
  Product Cost: AED250
  Delivery Charge: AED99 (free shipping threshold not met)
  
Profit Calculation:
  Profit = AED299 - AED250 - AED99 = -AED50 (Loss)
  Margin = (-AED50 / AED299) × 100 = -16.7%
```

## 🎨 UI/UX Features

### Visual Indicators
- **Green** cards/badges: Profitable orders/metrics
- **Red** cards/badges: Loss-making orders/metrics
- **Orange** badges: Products without cost price configured
- **Blue** highlights: Informational metrics

### Responsive Design
- Mobile-friendly tables with horizontal scroll
- Adaptive grid layouts for summary cards
- Touch-friendly buttons and inputs

### Interactive Elements
- Inline editing for cost prices
- Real-time search and filtering
- Hover effects on rows and cards
- Loading states and error handling

## ⚠️ Important Notes

### Data Privacy
- This module is a **dedicated internal tool**
- No conflict with public product pages
- Customer-facing pages remain unchanged
- All data is private to store administrators

### Cost Price Visibility
- Cost prices are **NOT visible** to customers
- Only accessible to authenticated store admins
- Used exclusively for profit calculations
- Protected by authentication tokens

### Excluded Orders
- **Cancelled orders** are excluded from profit calculations
- Only successful orders (all statuses except CANCELLED) are counted
- This ensures accurate profitability metrics

### Missing Cost Prices
- If a product doesn't have a cost price configured:
  - Order profit calculation treats product cost as AED0
  - This may inflate reported profits
  - **Action required:** Configure cost prices for accurate reports

## 🔒 Security

### Authentication
- All API endpoints require valid JWT tokens
- Token verification on every request
- User ID validation from decoded token

### Authorization
- Only store admins can access sales reports
- Cost price data is restricted
- No public API exposure

### Data Validation
- Input validation for cost prices (must be ≥ 0)
- Product ID validation before updates
- Date range validation for custom filters

## 🐛 Troubleshooting

### Issue: Profit showing as AED0
**Solution:** Configure cost prices in Product Pricing page

### Issue: Orders not appearing in report
**Possible causes:**
1. Orders are cancelled → Excluded by design
2. Date range filter too narrow → Expand date range
3. No orders exist in selected period → Check order history

### Issue: Incorrect profit calculations
**Checklist:**
1. Verify all products have cost prices set
2. Check delivery charges are correct in orders
3. Ensure products aren't deleted (breaks productId reference)

### Issue: CSV export not working
**Solutions:**
1. Check browser popup blocker
2. Verify authentication token is valid
3. Try a different date range

## 📊 Future Enhancements

### Planned Features
1. **Marketing Cost Tracking**
   - Add marketing expenses manually
   - Track cost per acquisition
   - ROI calculations

2. **Product-wise Profit Analysis**
   - Which products are most profitable
   - Best-selling vs most profitable comparison
   - Product performance rankings

3. **Automated Alerts**
   - Email reports for monthly performance
   - Alerts for loss-making products
   - Low margin warnings

4. **Advanced Analytics**
   - Profit trends graphs
   - Category-wise profitability
   - Customer lifetime value

5. **Bulk Import**
   - CSV import for cost prices
   - Bulk update functionality
   - Historical data import

## 💡 Best Practices

1. **Regular Updates**
   - Update cost prices when supplier prices change
   - Review monthly reports for trends
   - Export and archive quarterly data

2. **Accurate Data Entry**
   - Include all costs in cost price (shipping to you, customs, etc.)
   - Update delivery charges if rates change
   - Track marketing expenses separately

3. **Strategic Decisions**
   - Identify and promote high-margin products
   - Review pricing for loss-making products
   - Optimize shipping strategies

4. **Monitoring**
   - Check sales reports weekly
   - Monitor profit margins regularly
   - Track seasonal trends

## 📞 Support

For issues or questions about the Sales Report system:
1. Check this documentation first
2. Review the Troubleshooting section
3. Verify all cost prices are configured
4. Contact your development team for technical issues

---

**Version:** 1.0.0  
**Last Updated:** February 11, 2026  
**Module:** Sales Report & Profit Analysis
