"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function MetaPixel() {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const pathname = usePathname();

  if (!pixelId) return null;

  useEffect(() => {
    // Meta Pixel script and init are handled globally in app/layout.jsx.
    // This component only tracks PageView events to avoid duplicate inits.
    return;
  }, [pixelId]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.fbq) return;

    const routeKey = `${pathname || ""}?${window.location.search || ""}`;
    if (window.__lastMetaPageView === routeKey) return;

    window.fbq("track", "PageView");
    window.__lastMetaPageView = routeKey;
  }, [pathname]);

    return (
      <>
        {/* Meta Pixel noscript fallback */}
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: "none" }}
            src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
            alt="Meta Pixel"
          />
        </noscript>
      </>
    );
}
