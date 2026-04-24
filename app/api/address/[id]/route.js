export const dynamic = 'force-dynamic'

import dbConnect from '@/lib/mongodb'
import Address from '@/models/Address'
import { auth } from "@/lib/firebase-admin";

function parseAuthHeader(req) {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization')
  if (!auth) return null
  const parts = auth.split(' ')
  return parts.length === 2 ? parts[1] : null
}

export async function DELETE(req, { params }) {
  try {
    await dbConnect()
    const token = parseAuthHeader(req)
    if (!token) return Response.json({ error: 'Missing Authorization' }, { status: 401 })
const decoded = await auth.verifyIdToken(token)
    const userId = decoded.uid

    const { id } = await params

    // Find and delete address, ensuring it belongs to the authenticated user
    const address = await Address.findOneAndDelete({ _id: id, userId })
    
    if (!address) {
      return Response.json({ error: 'Address not found or unauthorized' }, { status: 404 })
    }

    return Response.json({ message: 'Address deleted successfully' }, { status: 200 })
  } catch (e) {
    console.error('[API /address/[id] DELETE] error:', e?.message || e)
    return Response.json({ error: 'Failed to delete address' }, { status: 500 })
  }
}

export async function PUT(req, { params }) {
  try {
    await dbConnect()
    const token = parseAuthHeader(req)
    if (!token) return Response.json({ error: 'Missing Authorization' }, { status: 401 })
const decoded = await auth.verifyIdToken(token)
    const userId = decoded.uid

    const { id } = await params
    const body = await req.json()

    // Update address, ensuring it belongs to the authenticated user
    const address = await Address.findOneAndUpdate(
      { _id: id, userId },
      { $set: body },
      { new: true }
    )
    
    if (!address) {
      return Response.json({ error: 'Address not found or unauthorized' }, { status: 404 })
    }

    return Response.json({ address }, { status: 200 })
  } catch (e) {
    console.error('[API /address/[id] PUT] error:', e?.message || e)
    return Response.json({ error: 'Failed to update address' }, { status: 500 })
  }
}
