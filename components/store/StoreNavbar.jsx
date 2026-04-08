'use client'


import Link from "next/link"
import Image from "next/image";
import { useState } from "react";
import { LogOut, Menu, X } from "lucide-react";
import Logo from "../../assets/logo/logo3.png";
import { useAuth } from "@/lib/useAuth";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";


const StoreNavbar = ({ storeInfo, isSidebarOpen = false, onToggleSidebar }) => {
    const { user } = useAuth();
    const [showConfirm, setShowConfirm] = useState(false);

    const handleLogout = async () => {
        try {
            await signOut(auth);
            window.location.href = "/";
        } catch (error) {
            console.error("Logout failed", error);
        } finally {
            setShowConfirm(false);
        }
    };

    return (
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 transition-all sm:px-6 lg:px-12">
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={onToggleSidebar}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-slate-100 md:hidden"
                    aria-label={isSidebarOpen ? "Close navigation menu" : "Open navigation menu"}
                    aria-expanded={isSidebarOpen}
                    aria-controls="store-sidebar"
                >
                    {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
                </button>

                <Link href="/store" className="relative text-4xl font-semibold text-slate-700">
                    <Image
                        src={Logo}
                        alt="Brandstored Logo"
                        width={180}
                        height={48}
                        className="h-10 w-auto object-contain sm:h-12"
                        priority
                    />
                </Link>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
                <p className="max-w-[110px] text-right text-sm leading-5 text-slate-700 sm:max-w-[180px] sm:text-base">
                    Hi, {storeInfo?.name || user?.displayName || user?.name || user?.email || ''}
                </p>
                <button
                    onClick={() => setShowConfirm(true)}
                    className="rounded-lg bg-red-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-600 sm:px-4"
                >
                    Logout
                </button>
            </div>

            {showConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
                    <div
                        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
                        onClick={() => setShowConfirm(false)}
                    />
                    <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
                        <div className="absolute -left-10 -top-14 h-40 w-40 bg-red-400/20 blur-3xl" />
                        <div className="absolute -right-8 -bottom-12 h-36 w-36 bg-orange-300/20 blur-3xl" />
                        <div className="relative p-6">
                            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
                                <LogOut size={24} />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900 text-center">Sign out of seller mode?</h3>
                            <p className="mt-2 text-sm text-slate-600 text-center">You can return anytime. We will keep your work safe.</p>
                            <div className="mt-5 grid grid-cols-2 gap-3">
                                <button
                                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                                    onClick={() => setShowConfirm(false)}
                                >
                                    Stay
                                </button>
                                <button
                                    className="w-full rounded-xl bg-gradient-to-r from-red-500 to-orange-400 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-200/50 hover:brightness-105 transition"
                                    onClick={handleLogout}
                                >
                                    Sign Out
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default StoreNavbar