"use client";
import { useEffect, useState } from "react";
import axios from "axios";
import Loading from "@/components/Loading";
import { auth } from '@/lib/firebase';

export default function PaymentOptionsAdmin() {
  const [products, setProducts] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await axios.get('/api/products?all=true&limit=500');
        if (!mounted) return;
        setProducts(data.products || []);
      } catch (e) {
        console.error(e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false };
  }, []);

  const toggleSelect = (id) => {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelected(s);
  };

  const applyBulk = async (setObj) => {
    if (selected.size === 0) return alert('Select at least one product');
    setBusy(true);
    try {
      const ids = Array.from(selected);
      let token = '';
      try { token = auth.currentUser ? await auth.currentUser.getIdToken() : ''; } catch(e) { token = ''; }
      await axios.post('/api/admin/products/bulk-update', { ids, set: setObj }, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
      // Refresh
      const { data } = await axios.get('/api/products?all=true&limit=500');
      setProducts(data.products || []);
      setSelected(new Set());
      alert('Bulk update applied');
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.error || e.message || 'Error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div>
      <h1 className="text-2xl mb-4">Product Payment Options (Bulk)</h1>
      <div className="mb-4 flex gap-3">
        <button disabled={busy} onClick={() => applyBulk({ codEnabled: true })} className="btn">Enable COD</button>
        <button disabled={busy} onClick={() => applyBulk({ codEnabled: false })} className="btn">Disable COD</button>
        <button disabled={busy} onClick={() => applyBulk({ onlinePaymentEnabled: true })} className="btn">Enable Online</button>
        <button disabled={busy} onClick={() => applyBulk({ onlinePaymentEnabled: false })} className="btn">Disable Online</button>
      </div>

      <div className="overflow-auto border rounded">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="p-2">Select</th>
              <th className="p-2 text-left">Product</th>
              <th className="p-2">COD</th>
              <th className="p-2">Online</th>
            </tr>
          </thead>
          <tbody>
            {products.map(p => (
              <tr key={p._id} className="border-t">
                <td className="p-2 text-center"><input type="checkbox" checked={selected.has(p._id)} onChange={() => toggleSelect(p._id)} /></td>
                <td className="p-2">{p.name} <div className="text-xs text-slate-400">{p._id}</div></td>
                <td className="p-2 text-center">{p.codEnabled ? 'Yes' : 'No'}</td>
                <td className="p-2 text-center">{p.onlinePaymentEnabled ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
