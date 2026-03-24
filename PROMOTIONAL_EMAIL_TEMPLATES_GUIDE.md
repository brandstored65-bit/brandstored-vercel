# 📧 Promotional Email Templates - Complete Guide

## Overview

QuickFynd's promotional email system features 20+ beautifully designed email templates with clickable product cards, responsive layouts, and automated delivery. Each email is optimized for deliverability and conversions.

## 🎨 Key Features

### ✅ Clickable Product Cards
- Every product in the email is **fully clickable**
- Links directly to the product page using product slug
- Hover effects work in most modern email clients
- "View Product →" button for clear call-to-action

### ✅ Responsive Design
- Works perfectly on desktop, tablet, and mobile
- 2-column grid layout optimized for email clients
- Images scale properly on all screen sizes
- Tested with Gmail, Outlook, Apple Mail, and Yahoo Mail

### ✅ Dynamic Content
- Products auto-fetched from your store based on sales performance
- Top 4 best-selling products automatically displayed
- Real-time pricing with sale prices and discounts
- Product images from your ImageKit CDN

### ✅ Discount Badges
- Automatic discount percentage calculation
- Eye-catching badges with gradient backgrounds
- Shows original price with strikethrough
- Sale price highlighted in green

### ✅ Brand Consistency
- QuickFynd branding throughout
- Consistent color schemes per template
- Professional footer with social links
- Unsubscribe option for compliance

---

## 📬 Email Template List

### 1. **Buy Now, Pay Later – Don't Miss Out** 💳
- **Color Theme:** Purple (#8b5cf6)
- **Best For:** Payment flexibility promotions
- **Message:** Shop now and pay at your convenience

### 2. **Price Dropped on Popular Picks** ⏬
- **Color Theme:** Red (#ef4444)
- **Best For:** Sale announcements, price reductions
- **Message:** Your favorite products just got more affordable

### 3. **Hurry! Limited-Time Deals Live** ⚡
- **Color Theme:** Amber (#f59e0b)
- **Best For:** Flash sales, urgent promotions
- **Message:** These exclusive deals won't last long

### 4. **Trending Now on Quickfynd** 🔥
- **Color Theme:** Pink (#ec4899)
- **Best For:** Popular products, social proof
- **Message:** See what everyone's buying!

### 5. **Your Wishlist Just Got Cheaper** 💝
- **Color Theme:** Rose (#f43f5e)
- **Best For:** Personalized promotions, price drops
- **Message:** Great news! Products you love are now at better prices

### 6. **Selling Fast! Grab It Before It's Gone** ⚠️
- **Color Theme:** Red (#dc2626)
- **Best For:** Low stock alerts, urgency
- **Message:** Limited stock alert! These popular items are selling out quickly

### 7. **Today's Best Finds Are Waiting** ✨
- **Color Theme:** Cyan (#06b6d4)
- **Best For:** Daily deals, curated selections
- **Message:** Discover today's handpicked selection just for you

### 8. **Flash Deals Ending Soon** ⏰
- **Color Theme:** Orange (#ea580c)
- **Best For:** Time-sensitive offers
- **Message:** Don't miss out on these incredible deals

### 9. **Smart Buys at Better Prices** 🎯
- **Color Theme:** Teal (#14b8a6)
- **Best For:** Value propositions, smart shopping
- **Message:** Shop smarter with these amazing deals

### 10. **Popular Products, Better Value** 🌟
- **Color Theme:** Purple (#9333ea)
- **Best For:** Customer favorites, value messaging
- **Message:** Get more value on our most popular products

---

## 🔧 Technical Implementation

### Product Data Structure

Each product in the email includes:

```javascript
{
  id: "product_id",           // MongoDB _id
  slug: "product-slug",        // URL-friendly slug
  name: "Product Name",        // Display name
  price: 1999,                 // Current/sale price
  originalPrice: 2999,         // Original price (if on sale)
  image: "https://..."         // Product image URL
}
```

### Product Link Generation

Products link to: `https://quickfynd.com/product/{slug}`

Example:
- Product Slug: `premium-wireless-headphones`
- Email Link: `https://quickfynd.com/product/premium-wireless-headphones`

### Email Sending

**Scheduled:** Daily at 4:30 PM via Inngest cron job
**Manual:** Via `/api/promotional-emails` endpoint
**Sender:** marketing@quickfynd.com

---

## 🎯 Product Card Design

### Layout Features
```
┌─────────────────────────┐
│   Product Image         │
│   (180px height)        │
│   ┌──────────────┐     │
│   │ 25% OFF      │     │ ← Discount Badge
│   └──────────────┘     │
├─────────────────────────┤
│ Product Name            │
│ (2 lines max)           │
│                         │
│ AED1,999  AED2,999         │ ← Prices
│                         │
│ [View Product →]       │ ← CTA Button
└─────────────────────────┘
```

### Design Specifications

**Product Card:**
- Background: White (#ffffff)
- Border: 1px solid #e5e7eb
- Border Radius: 10px
- Shadow: 0 2px 8px rgba(0,0,0,0.1)
- Full card is clickable link

**Product Image:**
- Height: 180px
- Object-fit: cover
- Background: #f3f4f6 (loading state)

**Discount Badge:**
- Position: Absolute top-right (10px)
- Background: Linear gradient red
- Color: White
- Font: 12px bold
- Padding: 6px 10px
- Shadow: 0 2px 6px rgba(239, 68, 68, 0.4)

**Product Name:**
- Font: 14px, 600 weight
- Color: #111827
- Max Height: 40px (2 lines)
- Overflow: Hidden with ellipsis

**Price Display:**
- Sale Price: 20px, bold, green (#059669)
- Original Price: 13px, strikethrough, gray (#9ca3af)
- Currency: AED (Indian Rupee)

**CTA Button:**
- Background: Green gradient (#10b981 → #059669)
- Color: White
- Padding: 8px 16px
- Border Radius: 6px
- Font: 13px, 600 weight
- Text: "View Product →"

---

## 🎨 Email Header Design

Each template has a unique header with:
- **Gradient Background** (theme-specific)
- **Large Emoji** (42px)
- **Bold Title** (28px, 700 weight)
- **Subtitle** (18px, 95% opacity)

Example:
```
┌────────────────────────────────┐
│     [Purple Gradient BG]       │
│                                │
│           💳                   │
│                                │
│     Buy Now, Pay Later         │
│      Don't Miss Out            │
└────────────────────────────────┘
```

---

## 📊 Email Footer

### Footer Includes:
- **QuickFynd Logo** with gradient badge
- **Tagline:** "Smart Shopping, Smart Savings"
- **Copyright** notice
- **Quick Links:**
  - Help Center
  - About Us
  - Manage Preferences
- **Unsubscribe Link** (compliance)

### Footer Style:
- Background: Dark (#111827)
- Text Color: Gray (#9ca3af)
- Link Color: Gray (#9ca3af)
- Unsubscribe: Underlined link

---

## 🚀 How to Use

### 1. Preview Templates

Visit: `/store/email-templates`

Features:
- View all 20+ templates
- See sample products
- Test on different screen sizes
- Download HTML
- Copy to clipboard

### 2. Send Promotional Emails

**Option A: Scheduled (Automatic)**
- Runs daily at 4:30 PM
- Auto-selects random template
- Sends to all customers
- Fetches top 4 selling products

**Option B: Manual (API)**
```bash
# Send to random customers with random template
GET /api/promotional-emails

# Send specific template to specific customers
POST /api/promotional-emails
{
  "templateId": "buy-now-pay-later",
  "customerEmails": ["customer@example.com"],
  "limit": 50
}
```

### 3. Track Results

Check email history:
- Store dashboard → Email history
- View sent count, open rates
- Filter by template type
- Monitor delivery status

---

## 🎯 Best Practices

### ✅ Do's

1. **Send at optimal times**
   - 4:30 PM works well (Inngest default)
   - Test different times for your audience

2. **Keep product selection relevant**
   - System auto-selects best-sellers
   - Ensures fresh, popular items

3. **Monitor unsubscribes**
   - Track unsubscribe rates
   - Adjust frequency if needed

4. **Test templates**
   - Preview before sending
   - Check on multiple devices
   - Verify links work correctly

5. **Use template variety**
   - Random selection keeps emails fresh
   - Different themes appeal to different customers

### ❌ Don'ts

1. **Don't send too frequently**
   - Daily is maximum recommended
   - Monitor customer feedback

2. **Don't ignore unsubscribes**
   - Honor opt-outs immediately
   - Required by law (CAN-SPAM, GDPR)

3. **Don't use broken images**
   - Ensure products have images
   - Use ImageKit for reliable hosting

4. **Don't forget mobile**
   - Always test on mobile devices
   - Most users read email on phones

5. **Don't overwhelm with products**
   - 4 products is optimal
   - More can reduce conversion

---

## 📱 Email Client Compatibility

### ✅ Fully Supported
- Gmail (Desktop & Mobile)
- Apple Mail (iOS & macOS)
- Outlook 2019+
- Yahoo Mail
- ProtonMail

### ⚠️ Partial Support
- Outlook 2016 (some styling limitations)
- Windows Mail (basic rendering)
- Older Android email clients

### ❌ Not Supported
- Outlook 2007-2013 (very limited CSS)
- Legacy email clients

---

## 🔍 Testing Checklist

Before sending to customers:

- [ ] Preview template in `/store/email-templates`
- [ ] Check product links work (click through)
- [ ] Verify images load correctly
- [ ] Test unsubscribe link
- [ ] Send test email to yourself
- [ ] View on desktop email client
- [ ] View on mobile device
- [ ] Check spam score (if possible)
- [ ] Verify sender name/address
- [ ] Confirm CTA buttons work

---

## 📈 Performance Metrics

### What to Track

1. **Delivery Rate**
   - % of emails successfully delivered
   - Target: >95%

2. **Open Rate**
   - % of customers who open email
   - Industry average: 15-25%

3. **Click-Through Rate (CTR)**
   - % who click product links
   - Target: 2-5%

4. **Conversion Rate**
   - % who purchase after clicking
   - Target: 1-3%

5. **Unsubscribe Rate**
   - % who opt out
   - Acceptable: <0.5%

---

## 🛠️ Customization Options

### Change Template Colors

Edit `/lib/promotionalEmailTemplates.js`:

```javascript
{
  id: 'your-template',
  color: '#your-hex-color', // Change this
  // ...
}
```

### Modify Product Grid

Edit `generateProductGrid()` function:

```javascript
// Change grid columns
grid-template-columns: repeat(2, 1fr)  // 2 columns
grid-template-columns: repeat(3, 1fr)  // 3 columns

// Change product limit
products.slice(0, 4)  // Show 4 products
products.slice(0, 6)  // Show 6 products
```

### Update Footer

Edit `getFooter()` function:

```javascript
// Add custom links
<a href="${baseUrl}/your-page">Your Link</a>

// Change branding
<span>⚡ QuickFynd</span> // Your brand
```

---

## 🎓 Advanced Features

### 1. Personalization

Add customer name to emails:

```javascript
template.template(products, customer.email, customer.name)
```

### 2. Segmentation

Send different templates to different customer groups:

```javascript
if (customer.preferences.electronics) {
  template = getTemplateById('tech-deals');
}
```

### 3. A/B Testing

Test different templates:

```javascript
const templateA = getTemplateById('buy-now-pay-later');
const templateB = getTemplateById('price-dropped');
// Send 50% to each
```

### 4. Dynamic Timing

Send at optimal time per customer:

```javascript
const optimalTime = getOptimalSendTime(customer.timezone);
await scheduleSend(optimalTime, customer.email);
```

---

## 📞 Support

### Need Help?

- **Documentation:** This file
- **Preview Tool:** `/store/email-templates`
- **API Reference:** `/api/promotional-emails`
- **Email History:** Store Dashboard

### Common Issues

**Products not showing:**
- Check products have `isPublished: true`
- Verify stock > 0
- Ensure images exist

**Links not working:**
- Verify `NEXT_PUBLIC_BASE_URL` in `.env`
- Check product slugs are set
- Test in preview mode first

**Emails not sending:**
- Verify email credentials
- Check customer email addresses
- Review error logs

---

## 🎉 Success Tips

1. **Start with one template** - Test before scaling
2. **Monitor metrics** - Track what works
3. **Get feedback** - Ask customers what they like
4. **Iterate** - Continuously improve
5. **Stay compliant** - Honor unsubscribes promptly

---

## 📝 Template Creation Checklist

Want to add a new template?

- [ ] Choose theme and color scheme
- [ ] Write compelling subject line
- [ ] Create header with emoji and title
- [ ] Write engaging intro text
- [ ] Define CTA text
- [ ] Add template to `promotionalTemplates` array
- [ ] Test in preview tool
- [ ] Send test emails
- [ ] Monitor performance

---

**Last Updated:** February 4, 2026
**Version:** 1.0
**Maintainer:** QuickFynd Development Team

---

## 🌟 Quick Reference

| Feature | Status | Notes |
|---------|--------|-------|
| Clickable Products | ✅ | Uses product slugs |
| Responsive Design | ✅ | Works on all devices |
| Discount Badges | ✅ | Auto-calculated |
| Unsubscribe Link | ✅ | Compliance required |
| Daily Scheduling | ✅ | 4:30 PM via Inngest |
| Preview Tool | ✅ | `/store/email-templates` |
| 20+ Templates | ✅ | Growing library |
| Brand Consistency | ✅ | QuickFynd styling |

**Your promotional emails are ready to drive sales! 🚀**
