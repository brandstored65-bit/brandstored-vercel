export const dynamic = 'force-dynamic'

import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import GuestUser from "@/models/GuestUser";
import User from "@/models/User";
import { getAuth } from "@/lib/firebase-admin";
import { sendPasswordSetupEmail } from "@/lib/email";

export async function POST(request) {
    try {
        const { token } = await request.json();

        if (!token) {
            return NextResponse.json({ error: "Token is required" }, { status: 400 });
        }

        await dbConnect();
        // Find guest user by token
        const guestUser = await GuestUser.findOne({ convertToken: token });

        if (!guestUser) {
            return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
        }

        // Check if token is expired
        if (guestUser.tokenExpiry && new Date() > guestUser.tokenExpiry) {
            return NextResponse.json({ error: "Token has expired" }, { status: 400 });
        }

        // Check if account already created
        if (guestUser.accountCreated) {
            return NextResponse.json({ 
                error: "Account already created. Please sign in.",
                accountExists: true 
            }, { status: 400 });
        }

        // Create user in Firebase Auth
        let firebaseUser;
        try {
            firebaseUser = await getAuth().createUser({
                email: guestUser.email,
                displayName: guestUser.name,
                emailVerified: false
            });
        } catch (firebaseError) {
            // If user already exists in Firebase
            if (firebaseError.code === 'auth/email-already-exists') {
                await GuestUser.findByIdAndUpdate(guestUser._id, {
                    accountCreated: true,
                    convertToken: null
                });
                return NextResponse.json({
                    error: "An account with this email already exists. Please sign in.",
                    accountExists: true
                }, { status: 400 });
            }
            throw firebaseError;
        }

        // Create user in our database
        await User.create({
            firebaseUid: firebaseUser.uid,
            name: guestUser.name,
            email: guestUser.email,
            image: '',
            cart: {}
        });

        // Mark guest user as converted
        await GuestUser.findByIdAndUpdate(guestUser._id, {
            accountCreated: true,
            convertToken: null
        });

        // Send password setup email (using your email utility)
        await sendPasswordSetupEmail(guestUser.email, guestUser.name);

        return NextResponse.json({
            success: true,
            message: "Account created successfully! Check your email to set your password.",
            email: guestUser.email
        });
    } catch (error) {
        console.error('Error converting guest to account:', error);
        return NextResponse.json({ 
            error: error.message || "Failed to create account" 
        }, { status: 500 });
    }
}

// Verify token without creating account
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const token = searchParams.get('token');

        if (!token) {
            return NextResponse.json({ error: "Token is required" }, { status: 400 });
        }

        await dbConnect();
        const guestUser = await GuestUser.findOne({ convertToken: token })
            .select('name email accountCreated tokenExpiry')
            .lean();

        if (!guestUser) {
            return NextResponse.json({ 
                valid: false, 
                error: "Invalid token" 
            }, { status: 400 });
        }

        if (guestUser.tokenExpiry && new Date() > guestUser.tokenExpiry) {
            return NextResponse.json({ 
                valid: false, 
                error: "Token has expired" 
            }, { status: 400 });
        }

        if (guestUser.accountCreated) {
            return NextResponse.json({ 
                valid: false, 
                error: "Account already created",
                accountExists: true 
            }, { status: 400 });
        }

        return NextResponse.json({
            valid: true,
            name: guestUser.name,
            email: guestUser.email
        });

    } catch (error) {
        console.error('Error verifying token:', error);
        return NextResponse.json({ 
            valid: false,
            error: error.message || "Failed to verify token" 
        }, { status: 500 });
    }
}
