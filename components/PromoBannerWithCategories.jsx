import React from "react";

const categories = [
  {
    label: "Trending Now",
    image: "/category1.png",
    color: "from-[#fff7e6] to-[#ffe0b2]",
    icon: "❤️",
  },
  {
    label: "Budget Buys",
    image: "/category2.png",
    color: "from-[#e6f7ff] to-[#b2ebf2]",
    icon: "AED",
  },
  {
    label: "Top Rated Picks",
    image: "/category3.png",
    color: "from-[#f3e5f5] to-[#ce93d8]",
    icon: "⭐",
  },
  {
    label: "Daily Essentials",
    image: "/category4.png",
    color: "from-[#fffde7] to-[#fff9c4]",
    icon: "🍳",
  },
];

export default function PromoBannerWithCategories() {
  return (
    <div className="w-full flex flex-row bg-white rounded-2xl overflow-hidden shadow-xl min-h-[320px]">
      {/* Left Offer */}
      <div className="flex flex-col justify-center items-center bg-gradient-to-b from-[#ffb300] to-[#ff9800] px-10 py-12 w-[340px] min-w-[300px] max-w-[400px]">
        <div className="text-3xl md:text-4xl font-extrabold text-white drop-shadow mb-2">
          Up to <span className="text-5xl md:text-6xl text-[#fffde7] font-black">35% OFF</span>
        </div>
        <div className="text-lg md:text-xl font-semibold text-white mb-2">on first order</div>
        <div className="text-base font-medium text-white mb-6">*Only on App</div>
        <button className="bg-white text-orange-600 font-bold px-7 py-3 rounded-xl text-lg shadow hover:bg-orange-100 transition">
          Download Now
        </button>
      </div>
      {/* Right Categories */}
      <div className="flex-1 bg-gradient-to-r from-[#a80077] to-[#66ff00] flex items-center px-8 py-8 overflow-x-auto">
        <div className="flex gap-8 w-full justify-center">
          {categories.map((cat, idx) => (
            <div
              key={cat.label}
              className={`flex flex-col items-center bg-white rounded-2xl shadow-lg px-6 py-6 min-w-[170px] max-w-[180px] border-2 border-orange-200 relative hover:scale-105 transition`}
            >
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-2xl bg-orange-100 rounded-full px-3 py-1 shadow">
                {cat.icon}
              </div>
              <div className="w-24 h-24 rounded-xl overflow-hidden bg-gradient-to-b mb-3 flex items-center justify-center">
                <img
                  src={cat.image}
                  alt={cat.label}
                  className="object-contain w-full h-full"
                  loading="lazy"
                />
              </div>
              <div className="text-base font-bold text-orange-700 text-center mt-2">
                {cat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
