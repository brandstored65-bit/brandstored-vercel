import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import authSeller from '@/middlewares/authSeller';
import Order from '@/models/Order';
import {
  buildGeoHaulConsignmentPayloadFromOrder,
  cancelGeoHaulConsignment,
  createGeoHaulConsignment,
  getGeoHaulTrackingUrl,
  updateGeoHaulConsignment,
} from '@/lib/geohaulexpress';

async function verifySeller(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const idToken = authHeader.split('Bearer ')[1];
  const { getAuth } = await import('firebase-admin/auth');
  const { initializeApp, applicationDefault, getApps } = await import('firebase-admin/app');
  if (getApps().length === 0) {
    initializeApp({ credential: applicationDefault() });
  }

  let decodedToken;
  try {
    decodedToken = await getAuth().verifyIdToken(idToken);
  } catch {
    return { error: NextResponse.json({ error: 'Invalid token' }, { status: 401 }) };
  }

  const storeId = await authSeller(decodedToken.uid);
  if (!storeId) {
    return { error: NextResponse.json({ error: 'not authorized' }, { status: 401 }) };
  }

  return { storeId };
}

function normalizeAction(action) {
  return String(action || 'create').trim().toLowerCase();
}

export async function POST(request) {
  try {
    await connectDB();

    const auth = await verifySeller(request);
    if (auth.error) return auth.error;

    const { storeId } = auth;
    const body = await request.json();
    const { orderId, action = 'create', awb, overrides = {} } = body || {};
    const normalizedAction = normalizeAction(action);

    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }

    const order = await Order.findOne({ _id: orderId, storeId }).lean();
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (!order.shippingAddress?.street || !order.shippingAddress?.city || !order.shippingAddress?.country) {
      return NextResponse.json(
        { error: 'Incomplete shipping address. street, city, and country are required.' },
        { status: 400 }
      );
    }

    if (normalizedAction === 'create') {
      const payload = buildGeoHaulConsignmentPayloadFromOrder(order, overrides);
      const result = await createGeoHaulConsignment(payload);

      const resolvedAwb = String(result?.data?.awb || '').trim();
      const updateData = {
        courier: 'GeoHaul Express',
      };

      if (resolvedAwb) {
        updateData.trackingId = resolvedAwb;
        updateData.trackingUrl = getGeoHaulTrackingUrl(resolvedAwb);
      }

      await Order.updateOne({ _id: orderId, storeId }, { $set: updateData });
      const updatedOrder = await Order.findById(orderId).lean();

      return NextResponse.json({
        success: true,
        action: 'create',
        message: result?.response?.message || 'GeoHaul consignment created successfully',
        providerResponse: result,
        order: updatedOrder,
      });
    }

    if (normalizedAction === 'update') {
      const resolvedAwb = String(awb || order.trackingId || '').trim();
      if (!resolvedAwb) {
        return NextResponse.json({ error: 'awb is required for update action' }, { status: 400 });
      }

      const payload = buildGeoHaulConsignmentPayloadFromOrder(order, {
        ...overrides,
        awb: resolvedAwb,
      });
      const result = await updateGeoHaulConsignment(payload);

      await Order.updateOne(
        { _id: orderId, storeId },
        {
          $set: {
            courier: 'GeoHaul Express',
            trackingId: resolvedAwb,
            trackingUrl: getGeoHaulTrackingUrl(resolvedAwb),
          },
        }
      );
      const updatedOrder = await Order.findById(orderId).lean();

      return NextResponse.json({
        success: true,
        action: 'update',
        message: result?.response?.message || 'GeoHaul consignment updated successfully',
        providerResponse: result,
        order: updatedOrder,
      });
    }

    if (normalizedAction === 'cancel') {
      const resolvedAwb = String(awb || order.trackingId || '').trim();
      if (!resolvedAwb) {
        return NextResponse.json({ error: 'awb is required for cancel action' }, { status: 400 });
      }

      const payload = { awb: resolvedAwb, ...(overrides || {}) };
      const result = await cancelGeoHaulConsignment(payload);

      await Order.updateOne(
        { _id: orderId, storeId },
        {
          $set: {
            courier: 'GeoHaul Express',
            trackingId: resolvedAwb,
            status: 'CANCELLED',
          },
        }
      );
      const updatedOrder = await Order.findById(orderId).lean();

      return NextResponse.json({
        success: true,
        action: 'cancel',
        message: result?.response?.message || 'GeoHaul consignment cancelled successfully',
        providerResponse: result,
        order: updatedOrder,
      });
    }

    return NextResponse.json({ error: 'Invalid action. Supported actions: create, update, cancel' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error?.message || 'GeoHaul integration failed',
        details: error?.details || null,
      },
      { status: error?.status || 500 }
    );
  }
}