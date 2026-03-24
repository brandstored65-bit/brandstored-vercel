# Environment Setup Guide

## 🚨 Current Issue
You're seeing: "Please define the MONGODB_URI environment variable in .env"

This means the `.env.local` file is missing or incomplete with required environment variables.

## ✅ Quick Fix

### 1. **Copy the template**
```bash
cp .env.example .env.local
```

### 2. **Fill in your values**
Edit `.env.local` and add your actual credentials (see sections below)

### 3. **Restart the development server**
```bash
npm run dev
```

---

## 📋 Required Environment Variables

### **MONGODB_URI** (CRITICAL - Required to start)
- **What it is:** Connection string to your MongoDB database
- **Get it from:** 
  - [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/) - Free cloud database
  - Or your local MongoDB instance
- **Format:** `mongodb+srv://username:password@cluster.mongodb.net/dbname?retryWrites=true&w=majority`
- **Example:** 
  ```
  MONGODB_URI=mongodb+srv://seller:pass123@quickfynd.mongodb.net/quickfynd_db?retryWrites=true&w=majority
  ```

### **Firebase Configuration** (CRITICAL - For authentication)

#### Get Firebase Admin Key:
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Click ⚙️ **Settings** → **Project settings**
4. Go to **Service Accounts** tab
5. Click **Generate New Private Key**
6. Copy the entire JSON and paste as `FIREBASE_SERVICE_ACCOUNT_KEY`

**Important:** It must be a single-line JSON string. Remove all line breaks.

#### Get Firebase Public Config:
1. In Firebase Console → **Project settings**
2. Under **Your apps** → Click your web app
3. Copy the config object:

```javascript
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyD...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=quickfynd.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=quickfynd-abc123
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=quickfynd-abc123.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc...
```

### **ImageKit Configuration** (For image uploads)

1. Sign up at [ImageKit.io](https://imagekit.io) (free tier available)
2. Go to **Settings** → **API Keys**
3. Copy:
   ```
   NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY=your_public_key_here
   IMAGEKIT_PRIVATE_KEY=your_private_key_here
   NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your_id/
   ```

### **Email Configuration** (For notifications)

Recommended: Use [Resend.com](https://resend.com) (free tier)

```
EMAIL_API_KEY=re_abc123xyz...
```

Or use alternatives: SendGrid, Mailgun, etc.

### **Admin Configuration**

```
ADMIN_EMAIL=admin@brandstored.com
NEXT_PUBLIC_ADMIN_EMAIL=admin@brandstored.com
```

### **Application URLs & Settings**

```
NEXT_PUBLIC_BASE_URL=http://localhost:3001
NEXT_PUBLIC_CURRENCY_SYMBOL=AED
NEXT_PUBLIC_COUNTRY_CODE=AE
```

---

## 🔒 Security Best Practices

⚠️ **NEVER commit `.env.local` to Git!**

The `.env.local` file is already in `.gitignore` to prevent accidental uploads. Always:
- ✅ Keep sensitive keys in `.env.local` (not .env)
- ✅ Share `.env.example` (template only, no real values)
- ✅ Never share `FIREBASE_SERVICE_ACCOUNT_KEY` or `IMAGEKIT_PRIVATE_KEY`
- ✅ Rotate keys if accidentally exposed

---

## 🧪 Testing Your Setup

After adding environment variables, restart the server:

```bash
npm run dev
```

Check the console output:
```
✓ MongoDB connected successfully
[ClientLayout] Loaded 150+ products
```

If you see these messages, you're all set! ✅

---

## ❌ Troubleshooting

### **Error: "Please define the MONGODB_URI environment variable"**
- Did you create `.env.local` file?
- Did you add `MONGODB_URI` with a valid connection string?
- Did you restart `npm run dev`?

### **Error: "Firebase initialization failed"**
- Is `FIREBASE_SERVICE_ACCOUNT_KEY` a valid JSON string?
- Make sure it has NO line breaks (should be one long string)
- Check that all quotes are escaped properly

### **Error: "ImageKit upload failed"**
- Is `NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY` correct?
- Is `IMAGEKIT_PRIVATE_KEY` correct?
- Is `NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT` your actual endpoint?

### **Products not loading after fixing MongoDB**
- Clear browser cache: `Ctrl+Shift+Delete`
- Check browser DevTools Console for any errors
- Try accessing `/api/products` directly to test the endpoint

---

## 📝 Setup Checklist

- [ ] Created `.env.local` file
- [ ] Added `MONGODB_URI` with valid connection string
- [ ] Added Firebase Admin key (`FIREBASE_SERVICE_ACCOUNT_KEY`)
- [ ] Added Firebase public config (all `NEXT_PUBLIC_FIREBASE_*`)
- [ ] Added ImageKit keys
- [ ] Added admin email addresses
- [ ] Running `npm run dev`
- [ ] Server shows "MongoDB connected successfully"
- [ ] No errors in browser console

---

## 🆘 Still Need Help?

1. Check that `.env.local` exists in the root directory (same level as `package.json`)
2. Run `npm run dev` from the project root directory
3. Check the terminal output for specific error messages
4. All URLs must be in the correct format (https://... not just domain.com)

---

**Last Updated:** March 2026
