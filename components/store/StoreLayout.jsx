'use client'
import { useEffect, useState } from "react"
import Loading from "../Loading"
import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"
import SellerNavbar from "./StoreNavbar"
import SellerSidebar from "./StoreSidebar"


import axios from "axios"
import { useAuth } from "@/lib/useAuth";

const StoreLayout = ({ children }) => {

    const { user, loading, getToken } = useAuth();

    const [isSeller, setIsSeller] = useState(false);
    const [sellerLoading, setSellerLoading] = useState(true);
    const [storeInfo, setStoreInfo] = useState(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const fetchIsSeller = async () => {
        if (!user) return;
        try {
            const token = await getToken(true); // Force refresh token
            if (!token) {
                setSellerLoading(false);
                return;
            }
            const { data } = await axios.get('/api/store/is-seller', { 
                headers: { Authorization: `Bearer ${token}` }
            });
            setIsSeller(data.isSeller);
            setStoreInfo(data.storeInfo);
        } catch (error) {
            setIsSeller(false);
        } finally {
            setSellerLoading(false);
        }
    };

    useEffect(() => {
        if (!loading && user) {
            fetchIsSeller();
        }
    }, [loading, user]);

    useEffect(() => {
        setIsSidebarOpen(false);
    }, [children]);

    return (loading || sellerLoading) ? (
        <Loading />
    ) : !user ? (
        <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
            <h1 className="text-2xl sm:text-4xl font-semibold text-slate-400">Authentication Required</h1>
            <p className="text-slate-500 mt-4 mb-8">Please sign in to access the store dashboard</p>
            <Link href="/store/login" className="bg-blue-600 text-white flex items-center gap-2 p-3 px-8 rounded-full hover:bg-blue-700 transition">
                Sign In
            </Link>
            <Link href="/" className="bg-slate-700 text-white flex items-center gap-2 mt-4 p-2 px-6 max-sm:text-sm rounded-full">
                Go to home <ArrowRightIcon size={18} />
            </Link>
        </div>
    ) : isSeller ? (
        <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-slate-50">
            <SellerNavbar
                storeInfo={storeInfo}
                isSidebarOpen={isSidebarOpen}
                onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
            />
            <div className="flex min-h-0 flex-1 md:flex-row md:items-stretch">
                <SellerSidebar
                    storeInfo={storeInfo}
                    isMobileOpen={isSidebarOpen}
                    onCloseMobile={() => setIsSidebarOpen(false)}
                />
                <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 sm:p-5 lg:pl-12 lg:pt-12">
                    {children}
                </div>
            </div>
        </div>
    ) : (
        <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
            <h1 className="text-2xl sm:text-4xl font-semibold text-slate-400">You are not authorized to access this page</h1>
            <p className="text-slate-500 mt-4 mb-6">Your account does not have seller access</p>
            <Link href="/create-store" className="bg-blue-600 text-white flex items-center gap-2 p-2 px-6 max-sm:text-sm rounded-full hover:bg-blue-700 transition">
                Request Store Access
            </Link>
            <Link href="/" className="bg-slate-700 text-white flex items-center gap-2 mt-4 p-2 px-6 max-sm:text-sm rounded-full">
                Go to home <ArrowRightIcon size={18} />
            </Link>
        </div>
    )
}

export default StoreLayout