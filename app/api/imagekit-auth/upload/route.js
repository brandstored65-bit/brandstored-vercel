export const dynamic = 'force-dynamic'

import imagekit from "@/configs/imageKit";
import { auth } from "@/lib/firebase-admin";
import { NextResponse } from "next/server";

export async function POST(req) {
    try {
        // Verify Firebase authentication
        const authHeader = req.headers.get("authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const token = authHeader.split(" ")[1];

        const decodedToken = await auth.verifyIdToken(token);
        const userId = decodedToken.uid;

        // Get the form data
        const formData = await req.formData();
        const file = formData.get("file");
        const folder = formData.get("folder") || "uploads";

        if (!file || !(file instanceof File)) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        // Convert file to buffer
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Generate unique filename
        const fileName = `${userId}_${Date.now()}_${file.name}`;

        // Upload to ImageKit
        const uploadResponse = await imagekit.upload({
            file: buffer,
            fileName: fileName,
            folder: folder,
            tags: [userId, "profile"],
        });

        return NextResponse.json({
            url: uploadResponse.url,
            fileId: uploadResponse.fileId,
            name: uploadResponse.name,
        }, { status: 200 });

    } catch (error) {
        console.error("ImageKit upload error:", error);
        return NextResponse.json({ 
            error: error.message || "Failed to upload image" 
        }, { status: 500 });
    }
}
