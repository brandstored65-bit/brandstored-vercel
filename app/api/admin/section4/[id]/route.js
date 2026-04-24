export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Section4 from '@/models/Section4';

// GET - Fetch single section
export async function GET(request, { params }) {
  try {
    await connectDB();
    const { id } = params;
    
    const section = await Section4.findById(id).lean();
    
    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }
    
    return NextResponse.json({ section }, { status: 200 });
  } catch (error) {
    console.error('Error fetching section:', error);
    return NextResponse.json({ error: 'Failed to fetch section' }, { status: 500 });
  }
}

// PUT - Update section
export async function PUT(request, { params }) {
  try {
    await connectDB();
    const { id } = params;
    const body = await request.json();
    
    const section = await Section4.findByIdAndUpdate(
      id,
      body,
      { new: true, runValidators: true }
    ).lean();
    
    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }
    
    return NextResponse.json({ section }, { status: 200 });
  } catch (error) {
    console.error('Error updating section:', error);
    return NextResponse.json({ error: 'Failed to update section' }, { status: 500 });
  }
}

// DELETE - Delete section
export async function DELETE(request, { params }) {
  try {
    await connectDB();
    const { id } = params;
    
    const section = await Section4.findByIdAndDelete(id);
    
    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }
    
    return NextResponse.json({ message: 'Section deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error deleting section:', error);
    return NextResponse.json({ error: 'Failed to delete section' }, { status: 500 });
  }
}
