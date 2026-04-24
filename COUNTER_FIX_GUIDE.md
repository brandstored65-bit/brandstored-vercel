# Firebase Setup & Order Fix Guide

## Step 1: Set FIREBASE_SERVICE_ACCOUNT_KEY Environment Variable

Your Firebase credentials must be stored as a single JSON string in the `.env` file.

Do not commit the real service account JSON into the repository. Keep the real value only in local or server environment variables.

```bash
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"brandstored-ecommerce","private_key_id":"<private-key-id>","private_key":"-----BEGIN PRIVATE KEY-----\n<private-key>\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk-fbsvc@brandstored-ecommerce.iam.gserviceaccount.com","client_id":"<client-id>","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40brandstored-ecommerce.iam.gserviceaccount.com","universe_domain":"googleapis.com"}'
```

Also add:

```bash
GOOGLE_CLOUD_PROJECT=brandstored-ecommerce
GCLOUD_PROJECT=brandstored-ecommerce
```

## Step 2: Fix Corrupted Counter in Database

If the error persists after refresh, run the cleanup script:

```bash
node scripts/fixCounterSeq.js
```

This will:
- Check the Counter document in MongoDB
- Repair it if the `seq` field is corrupted
- Reset to `55253` if needed

## Step 3: Test Order Placement

1. Go to checkout.
2. Place a test order.
3. If successful, the order will get `displayOrderNumber` starting from `55253`.

## Why This Error Happens

The error `Updating the path 'seq' would create a conflict` happens when:
- The MongoDB Counter document's `seq` field is corrupted or an incompatible type.
- A counter increment tries to update that value incorrectly.

The counter cleanup script resolves existing corrupted records.

## Deployment to AWS

1. Update `.env` on the server with the Firebase credentials.
2. Pull latest code: `git pull`
3. Rebuild: `npm run build`
4. Restart: `pm2 restart all --update-env`
5. Clean counter if needed: `node scripts/fixCounterSeq.js`