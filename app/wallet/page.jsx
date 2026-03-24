"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/useAuth";

export default function WalletPage() {
  const { user, loading, getToken } = useAuth();
  const [wallet, setWallet] = useState({ coins: 0, rupeesValue: 0, transactions: [] });
  const [error, setError] = useState("");
  const [fetching, setFetching] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const lastFetchRef = useRef(0);

  const openSignIn = () => {
    const signInEvent = new CustomEvent('openSignInModal', { detail: { mode: 'login' } });
    window.dispatchEvent(signInEvent);
  };

  const loadWallet = async (silent = false) => {
      if (loading) return;
      if (!user || !getToken) {
        setError("Please sign in to view your wallet.");
        return;
      }
      const now = Date.now();
      if (now - lastFetchRef.current < 1500) return;
      lastFetchRef.current = now;
      try {
        if (!silent && !hasLoaded) setFetching(true);
        setError("");
        const token = await getToken(false);
        if (!token) {
          setError("Please sign in to view your wallet.");
          return;
        }
        const res = await fetch("/api/wallet", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 401) {
            setError("Please sign in to view your wallet.");
          } else {
            setError(data?.error || "Failed to load wallet.");
          }
          return;
        }
        setWallet({
          coins: data.coins || 0,
          rupeesValue: data.rupeesValue || 0,
          transactions: data.transactions || [],
        });
        setHasLoaded(true);
      } catch (e) {
        const message = String(e?.message || "");
        if (message.includes("quota-exceeded")) {
          setError("Wallet temporarily unavailable. Please try again in a minute.");
        } else {
          setError("Failed to load wallet. Please try again.");
        }
      } finally {
        if (!silent && !hasLoaded) setFetching(false);
      }
    };

  useEffect(() => {
    loadWallet();
    const interval = setInterval(() => {
      loadWallet(true);
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [user, getToken, loading]);

  if (loading) return null;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-slate-600">
          Please sign in to view your wallet.
          <div className="mt-3">
            <button
              onClick={openSignIn}
              className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              Sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-rose-50 px-4 py-10">
      <div className="max-w-6xl mx-auto">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-violet-600 to-rose-500 p-6 text-white shadow-lg">
          <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/10" />
          <div className="absolute -bottom-12 -left-12 h-48 w-48 rounded-full bg-white/10" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">Wallet</h1>
              <p className="text-sm text-white/90 mt-1">Fast rewards, instant savings at checkout.</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="rounded-2xl bg-white/15 px-5 py-4 backdrop-blur">
                <p className="text-xs text-white/80">Wallet Balance</p>
                <p className="text-3xl font-bold">{wallet.coins}</p>
              </div>
              <div className="rounded-2xl bg-white/15 px-5 py-4 backdrop-blur">
                <p className="text-xs text-white/80">Wallet Value</p>
                <p className="text-3xl font-bold">AED {wallet.rupeesValue}</p>
              </div>
            </div>
          </div>
          <div className="relative z-10 mt-4 flex flex-wrap gap-2">
            <span className="text-xs font-semibold bg-white/15 px-3 py-1 rounded-full">10 wallet = AED10</span>
            <span className="text-xs font-semibold bg-white/15 px-3 py-1 rounded-full">10 wallet every order</span>
            <span className="text-xs font-semibold bg-white/15 px-3 py-1 rounded-full">+20 wallet on registration</span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900 mb-1">Wallet Snapshot</h2>
            <p className="text-sm text-slate-600 mb-3">Know how your wallet works in seconds.</p>
            <div className="space-y-2 text-sm text-slate-700">
              <div className="flex items-center justify-between">
                <span>Registration Bonus</span>
                <span className="font-semibold text-emerald-600">+20 wallet</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Per Order Earn</span>
                <span className="font-semibold text-indigo-600">+10 wallet</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Redeem Rate</span>
                <span className="font-semibold text-rose-600">10 Wallet = AED10</span>
              </div>
            </div>  
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900 mb-1">Earn Wallet</h2>
            <ul className="text-sm text-slate-600 space-y-2">
              <li>• New register: 20 wallet free bonus</li>
              <li>• 10 wallet on every order</li>
              <li>• Wallet added after delivery</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900 mb-1">Redeem Wallet</h2>
            <ul className="text-sm text-slate-600 space-y-2">
              <li>• Redeem at checkout</li>
              <li>• Minimum redeem: 10 wallet</li>
              <li>• Wallet never expires</li>
            </ul>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Frequently Asked Questions</h2>
            <div className="space-y-3 text-sm text-slate-600">
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                <p className="font-semibold text-slate-800">How much wallet do I get on registration?</p>
                <p>20 wallet is added as a welcome bonus.</p>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                <p className="font-semibold text-slate-800">How much wallet do I earn per purchase?</p>
                <p>10 wallet on every order.</p>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                <p className="font-semibold text-slate-800">When is wallet added?</p>
                <p>Wallet is added after delivery.</p>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                <p className="font-semibold text-slate-800">Does wallet expire?</p>
                <p>No, wallet never expires.</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Transactions</h2>
            {fetching && <div className="text-slate-500 text-sm">Loading...</div>}
            {!fetching && error && (
              <div className="text-red-600 text-sm mb-3">
                {error}
              </div>
            )}
            {!fetching && error && (
              <button
                onClick={loadWallet}
                className="text-xs text-blue-600 hover:underline"
              >
                Retry
              </button>
            )}
            {!fetching && !error && wallet.transactions.length === 0 && (
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-slate-600 text-sm">
                No transactions yet. Place an order to start earning wallet.
              </div>
            )}
            <ul className="divide-y">
              {wallet.transactions.map((t, idx) => (
                <li key={`${t.orderId || "tx"}-${idx}`} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {t.type === "EARN" ? "Earned" : "Redeemed"} {t.coins} wallet
                    </p>
                    <p className="text-xs text-slate-500">Order: {t.orderId || "-"}</p>
                  </div>
                  <div className={`text-sm font-semibold ${t.type === "EARN" ? "text-green-600" : "text-red-600"}`}>
                    {t.type === "EARN" ? "+" : "-"}AED {t.rupees}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
