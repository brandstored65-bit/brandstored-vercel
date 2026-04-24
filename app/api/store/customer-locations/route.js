export const dynamic = 'force-dynamic'

import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { auth } from "@/lib/firebase-admin";
import authSeller from "@/middlewares/authSeller";

export async function GET(request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const idToken = authHeader.split("Bearer ")[1];
    const decodedToken = await auth.verifyIdToken(idToken);
    const userId = decodedToken.uid;

    // Verify user has access to a store (owner or team member)
    await connectDB();
    const storeId = await authSeller(userId);
    if (!storeId) {
      return NextResponse.json(
        { error: "Store not found" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") || "all";

    // Calculate date range
    const now = new Date();
    let startDate = new Date(0); // All time

    if (filter === "today") {
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
    } else if (filter === "week") {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
    } else if (filter === "month") {
      startDate = new Date(now);
      startDate.setMonth(now.getMonth() - 1);
    }

    // Fetch all users and their locations
    const users = await User.find({
      "locations.timestamp": { $gte: startDate },
    });

    // Flatten and aggregate location data
    const allLocations = [];
    users.forEach((user) => {
      if (user.locations) {
        const filtered = user.locations.filter(
          (loc) => new Date(loc.timestamp) >= startDate
        );
        // Add user email to each location
        const locationsWithEmail = filtered.map(loc => ({
          ...loc.toObject(),
          userEmail: user.email || 'Guest',
          userId: user._id
        }));
        allLocations.push(...locationsWithEmail);
      }
    });

    // Sort by most recent first
    allLocations.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Generate summary statistics
    const countryMap = {};
    const cityMap = {};
    const deviceMap = {};
    const browserMap = {};

    allLocations.forEach((loc) => {
      countryMap[loc.country] = (countryMap[loc.country] || 0) + 1;
      cityMap[loc.city] = (cityMap[loc.city] || 0) + 1;
      deviceMap[loc.deviceType] = (deviceMap[loc.deviceType] || 0) + 1;
      browserMap[loc.browser] = (browserMap[loc.browser] || 0) + 1;
    });

    // Convert maps to sorted arrays
    const byCountry = Object.entries(countryMap)
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const byCity = Object.entries(cityMap)
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const byDevice = Object.entries(deviceMap)
      .map(([deviceType, count]) => ({ deviceType, count }))
      .sort((a, b) => b.count - a.count);

    const byBrowser = Object.entries(browserMap)
      .map(([browser, count]) => ({ browser, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const summary = {
      totalVisits: allLocations.length,
      topCountry: byCountry[0]?.country || "N/A",
      countryCount: byCountry[0]?.count || 0,
      topCity: byCity[0]?.city || "N/A",
      cityCount: byCity[0]?.count || 0,
      topDevice: byDevice[0]?.deviceType || "N/A",
      deviceCount: byDevice[0]?.count || 0,
      topBrowser: byBrowser[0]?.browser || "N/A",
      byCountry,
      byCity,
      byDevice,
      byBrowser,
    };

    return NextResponse.json({
      locations: allLocations,
      summary,
      filter,
      dateRange: {
        start: startDate.toISOString(),
        end: now.toISOString(),
      },
    });
  } catch (error) {
    console.error("Location analytics error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
