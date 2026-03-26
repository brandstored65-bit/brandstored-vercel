import {inngest} from './client'
import connectDB from '@/lib/mongodb'
import User from '@/models/User'
import Coupon from '@/models/Coupon'
import Store from '@/models/Store'
import EmailHistory from '@/models/EmailHistory'
import AbandonedCart from '@/models/AbandonedCart'
import mongoose from 'mongoose'

// Inngest Function to save user data to a database
export const syncUserCreation = inngest.createFunction(
    {id: 'sync-user-create'},
 
    async ({ event }) => {
        await connectDB();
        const {data} = event
        await User.create({
            _id: data.id,
            email: data.email_addresses[0].email_address,
            name: `${data.first_name} ${data.last_name}`,
            image: data.image_url,
        })
    }
)

// Inngest Function to update user data in database 
export const syncUserUpdation = inngest.createFunction(
    {id: 'sync-user-update'},

    async ({ event }) => {
        await connectDB();
        const { data } = event
        await User.findByIdAndUpdate(data.id, {
            email: data.email_addresses[0].email_address,
            name: `${data.first_name} ${data.last_name}`,
            image: data.image_url,
        })
    }
)

// Inngest Function to delete user from database
export const syncUserDeletion = inngest.createFunction(
    {id: 'sync-user-delete'},
 
    async ({ event }) => {
        await connectDB();
        const { data } = event
        await User.findByIdAndDelete(data.id)
    }
)

// Inngest Function to delete coupon on expiry
export const deleteCouponOnExpiry = inngest.createFunction(
    {id: 'delete-coupon-on-expiry'},
    { event: 'app/coupon.expired' },
    async ({ event, step }) => {
        const { data } = event
        const expiryDate = new Date(data.expires_at)
        await step.sleepUntil('wait-for-expiry', expiryDate)

        await step.run('delete-coupon-from-database', async () => {
            await connectDB();
            await Coupon.findOneAndDelete({ code: data.code })
        })
    }
)


// Inngest Function to send daily promotional emails
export const sendDailyPromotionalEmail = inngest.createFunction(
    { id: 'send-daily-promotional-email' },
    { cron: '30 16 * * *' },
    async ({ step }) => {
        const storeObjectId = await step.run('resolve-store-id', async () => {
            await connectDB();
            const envStoreId = process.env.PROMOTIONAL_STORE_ID;
            let storeId = envStoreId;
            if (!storeId) {
                const store = await Store.findOne({}).select('_id').lean();
                storeId = store?._id?.toString();
            }
            if (!storeId) return null;
            return new mongoose.Types.ObjectId(storeId);
        });

        const template = await step.run('get-random-template', async () => {
            const { getRandomTemplate } = await import('@/lib/promotionalEmailTemplates');
            return getRandomTemplate();
        });
        const customers = await step.run('fetch-customers', async () => {
            await connectDB();
            const users = await User.find({ email: { $exists: true, $ne: null, $ne: '' } }).lean();
            return users;
        });
        const products = await step.run('fetch-products', async () => {
            await connectDB();
            const Product = (await import('@/models/Product')).default;
            const featuredProducts = await Product.find({ inStock: true, stockQuantity: { $gt: 0 } }).sort({ createdAt: -1 }).limit(4).select('_id name slug AED price images description category stockQuantity').lean();
            return featuredProducts.map(p => ({ 
              id: p._id.toString(), 
              slug: p.slug, 
              name: p.name,
              description: p.description || '',
              category: p.category || 'Product',
              price: p.price, 
              originalPrice: p.AED || null, 
              image: p.images?.[0],
              images: p.images || [],
              stock: p.stockQuantity || 0
            }));
        });
        const emailResults = await step.run('send-emails', async () => {
            const { sendMail } = await import('@/lib/email');
            const results = [];
            for (const customer of customers) {
                try {
                    // Personalize subject with customer name
                    const customerFirstName = customer.name ? customer.name.split(' ')[0] : 'there';
                    const personalizedSubject = `HEY ${customerFirstName.toUpperCase()}! ${template.subject}`;
                    
                    await sendMail({ to: customer.email, subject: personalizedSubject, html: template.template(products), fromType: 'marketing' });
                    if (storeObjectId) {
                        try {
                            await EmailHistory.create({
                                storeId: storeObjectId,
                                type: 'promotional',
                                recipientEmail: customer.email,
                                recipientName: customer.name || 'Customer',
                                subject: personalizedSubject,
                                status: 'sent',
                                customMessage: `template:${template.id}`,
                                sentAt: new Date()
                            });
                        } catch (historyError) {
                            console.error('[promotional-email] Failed to save email history:', historyError);
                        }
                    }
                    results.push({ email: customer.email, status: 'sent', template: template.id });
                } catch (error) {
                    if (storeObjectId) {
                        try {
                            await EmailHistory.create({
                                storeId: storeObjectId,
                                type: 'promotional',
                                recipientEmail: customer.email,
                                recipientName: customer.name || 'Customer',
                                subject: template.subject,
                                status: 'failed',
                                errorMessage: error.message || 'Unknown error',
                                customMessage: `template:${template.id}`,
                                sentAt: new Date()
                            });
                        } catch (historyError) {
                            console.error('[promotional-email] Failed to save failed email history:', historyError);
                        }
                    }
                    results.push({ email: customer.email, status: 'failed', error: error.message });
                }
            }
            return results;
        });
        return { template: template.id, totalCustomers: customers.length, emailsSent: emailResults.filter(r => r.status === 'sent').length, emailsFailed: emailResults.filter(r => r.status === 'failed').length };
    }
)

// Inngest cron: send abandoned cart recovery emails 1 hour after last activity
export const sendAbandonedCartRecoveryEmails = inngest.createFunction(
    { id: 'send-abandoned-cart-recovery-emails' },
    { cron: '0 * * * *' }, // Every hour on the hour
    async ({ step }) => {
        const carts = await step.run('find-eligible-carts', async () => {
            await connectDB();
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            const found = await AbandonedCart.find({
                email: { $exists: true, $ne: null, $ne: '' },
                recoveryEmailSentAt: null,
                lastSeenAt: { $lte: oneHourAgo },
            }).limit(100).lean();
            return found.map(c => ({
                _id: String(c._id),
                email: c.email,
                name: c.name || null,
                items: c.items || [],
                cartTotal: c.cartTotal || null,
                currency: c.currency || 'AED',
                storeId: String(c.storeId),
            }));
        });

        if (!carts.length) return { sent: 0 };

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.quickfynd.com';
        const checkoutUrl = `${appUrl}/checkout`;

        const results = await step.run('send-emails', async () => {
            const { sendMail } = await import('@/lib/email');
            const sent = [];

            for (const cart of carts) {
                try {
                    const customerName = cart.name || 'there';

                    const itemsHtml = Array.isArray(cart.items) && cart.items.length > 0
                        ? cart.items.map(item => `
                            <tr>
                              <td style="padding:10px 8px;border-bottom:1px solid #eee;">
                                ${item.image ? `<img src="${item.image}" alt="${item.name || ''}" width="54" style="border-radius:6px;vertical-align:middle;margin-right:8px;"/>` : ''}
                                <span style="font-weight:600;color:#1a1a1a;">${item.name || 'Product'}</span>
                              </td>
                              <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:center;color:#555;">x${item.quantity || 1}</td>
                              <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:600;color:#DC013C;">
                                ${cart.currency} ${Number(item.price || 0).toFixed(2)}
                              </td>
                            </tr>`).join('')
                        : `<tr><td colspan="3" style="padding:10px;color:#888;">Your saved items</td></tr>`;

                    const html = `
                      <!DOCTYPE html>
                      <html>
                        <head><meta charset="UTF-8"/></head>
                        <body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f4f4f5;">
                          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
                            <tr><td align="center">
                              <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
                                <tr>
                                  <td style="background:#DC013C;padding:32px 40px;text-align:center;">
                                    <img src="${appUrl}/logo/logo3.png" alt="Logo" style="max-width:160px;margin-bottom:18px;display:block;margin-left:auto;margin-right:auto;"/>
                                    <h1 style="color:#fff;margin:0;font-size:26px;font-weight:700;">You left something behind!</h1>
                                    <p style="color:rgba(255,255,255,0.9);margin:10px 0 0;font-size:15px;">Your cart is waiting. Complete your order before it's gone.</p>
                                  </td>
                                </tr>
                                <tr>
                                  <td style="padding:36px 40px;">
                                    <p style="font-size:16px;color:#333;margin:0 0 24px;">Hey <strong>${customerName}</strong>,</p>
                                    <p style="font-size:15px;color:#555;margin:0 0 28px;line-height:1.6;">
                                      We noticed you left some great items in your cart. We saved them for you — click below to continue where you left off.
                                    </p>
                                    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:8px;overflow:hidden;margin-bottom:28px;">
                                      <thead>
                                        <tr style="background:#f8f9fa;">
                                          <th style="padding:10px 8px;text-align:left;font-size:13px;color:#666;font-weight:600;">Item</th>
                                          <th style="padding:10px 8px;text-align:center;font-size:13px;color:#666;font-weight:600;">Qty</th>
                                          <th style="padding:10px 8px;text-align:right;font-size:13px;color:#666;font-weight:600;">Price</th>
                                        </tr>
                                      </thead>
                                      <tbody>${itemsHtml}</tbody>
                                      ${cart.cartTotal ? `
                                      <tfoot>
                                        <tr style="background:#fef2f2;">
                                          <td colspan="2" style="padding:12px 8px;font-weight:700;font-size:15px;color:#1a1a1a;">Total</td>
                                          <td style="padding:12px 8px;text-align:right;font-weight:700;font-size:16px;color:#DC013C;">${cart.currency} ${Number(cart.cartTotal).toFixed(2)}</td>
                                        </tr>
                                      </tfoot>` : ''}
                                    </table>
                                    <table width="100%" cellpadding="0" cellspacing="0">
                                      <tr>
                                        <td align="center" style="padding:8px 0 28px;">
                                          <a href="${checkoutUrl}"
                                             style="display:inline-block;background:#DC013C;color:#ffffff;padding:16px 48px;border-radius:8px;font-size:17px;font-weight:700;text-decoration:none;letter-spacing:0.3px;">
                                            Complete My Order →
                                          </a>
                                        </td>
                                      </tr>
                                    </table>
                                    <p style="font-size:13px;color:#999;margin:0;text-align:center;">If you didn't expect this email, you can safely ignore it.</p>
                                  </td>
                                </tr>
                                <tr>
                                  <td style="background:#f8f9fa;padding:20px 40px;text-align:center;border-top:1px solid #eee;">
                                    <p style="font-size:12px;color:#aaa;margin:0;">© ${new Date().getFullYear()} QuickFynd. All rights reserved.</p>
                                  </td>
                                </tr>
                              </table>
                            </td></tr>
                          </table>
                        </body>
                      </html>`;

                    await sendMail({
                        to: cart.email,
                        subject: `${customerName !== 'there' ? customerName + ', you' : 'You'} left something in your cart!`,
                        html,
                        fromType: 'marketing',
                    });

                    await AbandonedCart.findByIdAndUpdate(cart._id, { recoveryEmailSentAt: new Date() });
                    sent.push({ email: cart.email, status: 'sent' });
                } catch (err) {
                    console.error('[abandoned-cart-recovery] Failed for', cart.email, err.message);
                    sent.push({ email: cart.email, status: 'failed', error: err.message });
                }
            }
            return sent;
        });

        return {
            sent: results.filter(r => r.status === 'sent').length,
            failed: results.filter(r => r.status === 'failed').length,
        };
    }
)
