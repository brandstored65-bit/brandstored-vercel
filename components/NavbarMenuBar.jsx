'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const MAX_ITEMS = 12;
const SKELETON_ITEMS = Array.from({ length: 8 });

export default function NavbarMenuBar() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    const fetchMenu = async () => {
      try {
        const response = await fetch('/api/store/navbar-menu', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) {
          setItems([]);
          setLoading(false);
          return;
        }
        const data = await response.json();
        const nextItems = Array.isArray(data.items) ? data.items.slice(0, MAX_ITEMS) : [];
        setItems(nextItems);
      } catch (error) {
        if (error?.name === 'AbortError') return;
        setItems([]);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchMenu();

    return () => {
      controller.abort();
    };
  }, []);

  if (!loading && items.length === 0) return null;

  const normalizeUrl = (item) => {
    if (item?.url) return item.url;
    if (item?.categoryId) return `/shop?category=${item.categoryId}`;
    return '/shop';
  };

  return (
    <div className="w-full bg-white text-gray-800 border-b border-gray-200">
      <div className="max-w-[1240px] mx-auto px-4 py-2.5">
        <div
          className="flex items-center justify-start gap-3 overflow-x-auto whitespace-nowrap"
          style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}
        >
          <Link
            href="/shop"
            className="flex items-center gap-2 text-[13px] font-semibold tracking-[0.02em] uppercase text-gray-800 hover:text-gray-600 transition whitespace-nowrap"
          >
          <span>All</span>
          </Link>
          {loading && (
            <div className="flex items-center gap-3">
              {SKELETON_ITEMS.map((_, idx) => (
                <div key={`skeleton-${idx}`} className="flex items-center flex-shrink-0">
                  <span className="mx-2 text-gray-400">|</span>
                  <div className="h-4 w-20 rounded-full bg-gray-200 animate-pulse" />
                </div>
              ))}
            </div>
          )}
          {!loading && items.map((item, index) => (
            <div key={`${item.label || item.name || 'menu'}-${index}`} className="flex items-center flex-shrink-0">
              <span className="mx-2 text-gray-400">|</span>
              <Link
                href={normalizeUrl(item)}
                className="text-[13px] font-semibold tracking-[0.01em] text-gray-800 hover:text-gray-600 transition whitespace-nowrap"
              >
                {item.label || item.name || 'Menu'}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
