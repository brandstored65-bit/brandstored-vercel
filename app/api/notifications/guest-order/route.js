export const dynamic = 'force-dynamic'

import { NextResponse } from "next/server";

export async function POST(request) {
    try {
        await request.json();
        return NextResponse.json({ message: 'Guest order email disabled' });
    } catch (error) {
        return NextResponse.json({ message: 'Guest order email disabled' });
    }
}
