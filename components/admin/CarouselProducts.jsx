import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '@/lib/useAuth';

export default function CarouselProducts() {
  const [allProducts, setAllProducts] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const { getToken } = useAuth();
  const scrollRef = useRef(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [{ data: all }, { data: carousel }] = await Promise.all([
          axios.get('/api/products?limit=1000'),
          axios.get('/api/store/carousel-products'),
        ]);

        setAllProducts(all.products || []);
        setSelected(carousel.productIds || []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const toggleProduct = (id) => {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((pid) => pid !== id)
        : [...prev, id]
    );
  };

  const save = async () => {
    try {
      setSaving(true);
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      await axios.post(
        '/api/store/carousel-products',
        { productIds: selected },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setMessage('Carousel products saved successfully!');
    } catch {
      setMessage('Failed to save carousel products');
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(''), 2500);
    }
  };

  // Mouse drag scrolling
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  const handleMouseDown = (e) => {
    isDragging.current = true;
    startX.current = e.pageX - scrollRef.current.offsetLeft;
    scrollLeft.current = scrollRef.current.scrollLeft;
  };

  const handleMouseLeave = () => { isDragging.current = false; };
  const handleMouseUp = () => { isDragging.current = false; };
  const handleMouseMove = (e) => {
    if (!isDragging.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX.current) * 2; // scroll speed
    scrollRef.current.scrollLeft = scrollLeft.current - walk;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500 bg-white min-h-screen">
        Loading products...
      </div>
    );
  }

  return (
    <div className="mt-10 px-4 min-h-screen" style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-extrabold text-indigo-900 drop-shadow mb-1">
            Carousel Slider Products
          </h2>
          <p className="text-base text-indigo-500">Select products for homepage slider</p>
        </div>
        <span className="text-base font-semibold text-green-600">
          Selected: {selected.length}
        </span>
      </div>

      {/* Message */}
      {message && (
        <div className="mb-5 rounded-lg bg-green-100 px-4 py-2 text-base text-green-800 font-semibold shadow">
          {message}
        </div>
      )}

      {/* Horizontal scrollable products */}
      <div
        ref={scrollRef}
        className="flex gap-6 overflow-x-auto py-6 cursor-grab scroll-smooth snap-x snap-mandatory"
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
      >
        {allProducts.map((product) => {
          const isSelected = selected.includes(product._id);
          return (
            <div
              key={product._id}
              onClick={() => toggleProduct(product._id)}
              className={`relative flex-shrink-0 w-64 rounded-2xl border transition-all duration-200 cursor-pointer snap-start bg-white shadow-lg hover:shadow-2xl hover:scale-105
                ${isSelected ? 'border-green-500 ring-2 ring-green-300' : 'border-gray-200'}
              `}
              style={{ minHeight: 320 }}
            >
              {/* Selected Badge */}
              {isSelected && (
                <span className="absolute top-3 right-3 z-10 rounded-full bg-green-500 px-3 py-1 text-xs font-bold text-white shadow">
                  ✓ Selected
                </span>
              )}

              {/* Image */}
              <div className="aspect-square overflow-hidden rounded-t-2xl bg-gradient-to-b from-indigo-100 to-white flex items-center justify-center">
                <img
                  src={product.images?.[0]?.url || product.images?.[0] || '/placeholder.png'}
                  alt={product.name}
                  className="h-40 w-40 object-contain drop-shadow"
                />
              </div>

              {/* Content */}
              <div className="p-4 text-center">
                <p className="text-base font-semibold text-indigo-900 line-clamp-2 mb-1">
                  {product.name}
                </p>
                <p className="text-lg font-bold text-green-700">
                  AED{product.price}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sticky Save Bar */}
      <div className="sticky bottom-0 mt-8 border-t bg-gradient-to-r from-indigo-100 to-white py-5 px-4 flex items-center justify-between shadow-lg rounded-b-2xl">
        <p className="text-base text-indigo-700 font-semibold">
          {selected.length} products selected for carousel
        </p>
        <button
          onClick={save}
          disabled={saving}
          className="rounded-xl bg-green-600 px-7 py-3 text-white font-bold text-base shadow hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Save Carousel Products'}
        </button>
      </div>
    </div>
  );
}
