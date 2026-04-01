"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { getTrackingStoreId, trackCustomerBehavior } from "@/lib/customerBehaviorTracking";

const BLOCKED_PREFIXES = ["/store", "/admin", "/api"];

export default function PageTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastPageRef = useRef("");
  const enteredAtRef = useRef(0);
  const maxScrollDepthRef = useRef(0);

  useEffect(() => {
    if (!pathname) return;
    if (BLOCKED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return;

    const query = searchParams?.toString() || "";
    const pagePath = query ? `${pathname}?${query}` : pathname;
    if (lastPageRef.current === pagePath) return;
    lastPageRef.current = pagePath;

    const storeId = getTrackingStoreId();
    if (!storeId) return;

    enteredAtRef.current = Date.now();
    maxScrollDepthRef.current = 0;

    const updateScrollDepth = () => {
      const doc = document.documentElement;
      const scrollTop = window.scrollY || doc.scrollTop || 0;
      const maxScrollable = Math.max((doc.scrollHeight || 0) - (window.innerHeight || 0), 1);
      const depth = Math.min(100, Math.max(0, (scrollTop / maxScrollable) * 100));
      if (depth > maxScrollDepthRef.current) {
        maxScrollDepthRef.current = depth;
      }
    };

    window.addEventListener("scroll", updateScrollDepth, { passive: true });
    updateScrollDepth();

    trackCustomerBehavior({
      eventType: "page_view",
      storeId,
      pagePath,
      nextAction: "page_enter",
    });

    return () => {
      window.removeEventListener("scroll", updateScrollDepth);
      const durationMs = Math.max(0, Date.now() - (enteredAtRef.current || Date.now()));

      trackCustomerBehavior({
        eventType: "page_view",
        storeId,
        pagePath,
        durationMs,
        scrollDepthPercent: Math.round(maxScrollDepthRef.current || 0),
        nextAction: "page_exit",
      });
    };
  }, [pathname, searchParams]);

  return null;
}
