"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import axios from "axios";
import Dummy from '../assets/ads.png';

export default function TopDeals() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [{ data: sectionData }, { data: productData }] = await Promise.all([
          axios.get("/api/admin/home-sections"),
          axios.get("/api/products")
        ]);

        const adminSections = sectionData.sections || [];
        const allProducts = productData.products || productData;

        const section = adminSections.find(s => s.category);
// let result = allProducts.filter(p => p.category === "Trending Deals");
let result = allProducts;
        if (section && section.category) {
          result = allProducts.filter(p => p.category === section.category);
        }

        setProducts(result);
      } catch {
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="w-full flex justify-center px-3 sm:px-4 mt-6 sm:mt-8">
      <div className="w-full max-w-[1250px] flex flex-col lg:flex-row gap-4 lg:gap-6">

        {/* LEFT GRID PRODUCTS */}
        <div className="flex-1 w-full">
          <h2 className="text-base sm:text-lg md:text-[28px] font-semibold mb-4 sm:mb-5">Top Deals</h2>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4 md:gap-6">
              {[...Array(10)].map((_, index) => (
                <div
                  key={`skeleton-${index}`}
                  className="cursor-pointer text-center flex flex-col items-center"
                >
                  {/* Skeleton Image */}
                  <div
                    className="w-full aspect-square rounded-md"
                    style={{
                      background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 1.5s infinite',
                    }}
                  />
                  {/* Skeleton Title */}
                  <div
                    className="h-2 sm:h-3 mx-auto mt-2 sm:mt-3 rounded"
                    style={{
                      width: '80%',
                      background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 1.5s infinite',
                    }}
                  />
                  {/* Skeleton Price */}
                  <div
                    className="h-2 sm:h-3 mx-auto mt-1.5 sm:mt-2 rounded"
                    style={{
                      width: '60%',
                      background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 1.5s infinite',
                    }}
                  />
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <p className="text-gray-500 py-8 text-center text-sm sm:text-base">No Deals Found</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4 md:gap-6">
              {products?.slice(0, 10).map((item, i) => {
                const img =
                  item.images?.[0] && item.images[0] !== ""
                    ? item.images[0]
                    : "https://ik.imagekit.io/jrstupuke/placeholder.png";

                return (
                  <a
                    key={i}
                    href={`/product/${item.slug}`}
                    className="cursor-pointer text-center block group flex flex-col items-center"
                  >
                    <div className="w-full aspect-square bg-gray-50 rounded-md overflow-hidden flex items-center justify-center group-hover:bg-gray-100 transition-colors">
                      <img
                        src={img}
                        alt={item.name}
                        className="h-full w-full object-contain p-2 sm:p-3 group-hover:scale-110 transition-transform duration-200"
                        onError={e => { e.currentTarget.src = "https://ik.imagekit.io/jrstupuke/placeholder.png"; }}
                      />
                    </div>
                    <p className="text-[11px] sm:text-[13px] md:text-[15px] font-medium mt-2 sm:mt-2.5 line-clamp-2 w-full px-1">
                      {item.name}
                    </p>
                    <p className="font-bold text-[10px] sm:text-[12px] md:text-[16px] mt-1 sm:mt-1.5 text-[#E6003E]">
                      From AED{item.price}
                    </p>
                  </a>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT FIXED BANNER - HIDDEN ON MOBILE */}
        <div className="w-full sm:w-[250px] md:w-[300px] hidden lg:block">
          <Image
            src={Dummy}
            alt="Offer Banner"
            className="w-full rounded-lg shadow"
          />
        </div>
      </div>
    </div>
  );
}
