import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import AbandonedCart from '@/models/AbandonedCart';
import authSeller from '@/middlewares/authSeller';
import { getAuth } from '@/lib/firebase-admin';
import { sendMail } from '@/lib/email';

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const userId = decodedToken.uid;

    const storeId = await authSeller(userId);
    if (!storeId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await dbConnect();

    const { cartId } = await request.json();
    if (!cartId) return NextResponse.json({ error: 'cartId is required' }, { status: 400 });

    const cart = await AbandonedCart.findOne({ _id: cartId, storeId }).lean();
    if (!cart) return NextResponse.json({ error: 'Cart not found' }, { status: 404 });

    if (!cart.email) {
      return NextResponse.json({ error: 'No email address for this customer' }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.quickfynd.com';
    const checkoutUrl = `${appUrl}/checkout`;
    const customerName = cart.name || 'there';

    // Build items HTML
    const itemsHtml = Array.isArray(cart.items) && cart.items.length > 0
      ? cart.items.map(item => `
          <tr>
            <td style="padding:10px 8px;border-bottom:1px solid #eee;">
              ${item.image ? `<img src="${item.image}" alt="${item.name || ''}" width="54" style="border-radius:6px;vertical-align:middle;margin-right:8px;"/>` : ''}
              <span style="font-weight:600;color:#1a1a1a;">${item.name || 'Product'}</span>
            </td>
            <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:center;color:#555;">x${item.quantity || 1}</td>
            <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:600;color:#DC013C;">
              ${cart.currency || 'AED'} ${Number(item.price || 0).toFixed(2)}
            </td>
          </tr>
        `).join('')
      : `<tr><td colspan="3" style="padding:10px;color:#888;">Your saved items</td></tr>`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head><meta charset="UTF-8"/></head>
        <body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f4f4f5;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
            <tr><td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

                <!-- Header -->
                <tr>
                  <td style="background:#DC013C;padding:32px 40px;text-align:center;">
                    <img src="${appUrl}/logo/logo3.png" alt="Logo" style="max-width:160px;margin-bottom:18px;display:block;margin-left:auto;margin-right:auto;"/>
                    <h1 style="color:#fff;margin:0;font-size:26px;font-weight:700;">You left something behind!</h1>
                    <p style="color:rgba(255,255,255,0.9);margin:10px 0 0;font-size:15px;">Your cart is waiting for you. Come back and complete your order.</p>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding:36px 40px;">
                    <p style="font-size:16px;color:#333;margin:0 0 24px;">Hey <strong>${customerName}</strong>,</p>
                    <p style="font-size:15px;color:#555;margin:0 0 28px;line-height:1.6;">
                      We noticed you left some great items in your cart. We saved them for you — click below to continue where you left off.
                    </p>

                    <!-- Items table -->
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
                          <td style="padding:12px 8px;text-align:right;font-weight:700;font-size:16px;color:#DC013C;">${cart.currency || 'AED'} ${Number(cart.cartTotal).toFixed(2)}</td>
                        </tr>
                      </tfoot>` : ''}
                    </table>

                    <!-- CTA Button -->
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

                    <p style="font-size:13px;color:#999;margin:0;text-align:center;">
                      If you didn't expect this email, you can safely ignore it.
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background:#f8f9fa;padding:20px 40px;text-align:center;border-top:1px solid #eee;">
                    <p style="font-size:12px;color:#aaa;margin:0;">
                      © ${new Date().getFullYear()} QuickFynd. All rights reserved.
                    </p>
                  </td>
                </tr>

              </table>
            </td></tr>
          </table>
        </body>
      </html>
    `;

    await sendMail({
      to: cart.email,
      subject: `${customerName !== 'there' ? customerName + ', you' : 'You'} left something in your cart!`,
      html,
      fromType: 'marketing',
    });

    // Mark email sent timestamp
    await AbandonedCart.findByIdAndUpdate(cartId, { recoveryEmailSentAt: new Date() });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error sending abandoned cart email:', error);
    return NextResponse.json({ error: error.message || 'Failed to send email' }, { status: 500 });
  }
}
