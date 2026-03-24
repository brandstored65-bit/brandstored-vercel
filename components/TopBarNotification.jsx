'use client'
import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import Link from 'next/link'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useRouter } from 'next/navigation'

const TopBarNotification = () => {
  const [visible, setVisible] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [showLoginPrompt, setShowLoginPrompt] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Check auth state
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsLoggedIn(!!user)
      
      if (user) {
        // Don't show to logged-in users
        setVisible(false)
        return
      }

      // Check if user dismissed and when
      const dismissedTime = localStorage.getItem('topBarDismissedTime')
      if (dismissedTime) {
        const sixHoursInMs = 6 * 60 * 60 * 1000
        const timePassed = Date.now() - parseInt(dismissedTime)
        
        if (timePassed < sixHoursInMs) {
          // Still within 6 hours, don't show
          setVisible(false)
          return
        }
      }

      // Show the notification
      setVisible(true)
    })

    return () => unsubscribe()
  }, [])

  const handleClose = () => {
    setVisible(false)
    // Store current timestamp
    localStorage.setItem('topBarDismissedTime', Date.now().toString())
  }

  const handleClaimClick = (e) => {
    e.preventDefault()
    
    // Check if user is logged in
    if (!auth.currentUser) {
      // Show login prompt
      setShowLoginPrompt(true)
    } else {
      // Already logged in, go to products
      router.push('/products')
    }
  }

  const handleSignup = () => {
    // Mark that user claimed the welcome bonus
    localStorage.setItem('welcomeBonusClaimed', 'true')
    localStorage.setItem('welcomeBonusTimestamp', Date.now().toString())
    
    // Close the login prompt
    setShowLoginPrompt(false)
    
    // Trigger the sign-in modal (you'll need to dispatch an event or use a global state)
    const signInEvent = new CustomEvent('openSignInModal', { detail: { isRegister: true } })
    window.dispatchEvent(signInEvent)
  }

  const handleLogin = () => {
    setShowLoginPrompt(false)
    const signInEvent = new CustomEvent('openSignInModal', { detail: { isRegister: false } })
    window.dispatchEvent(signInEvent)
  }

  if (!visible || isLoggedIn) return null

  return (
    <>
      <div className="bg-black text-white py-1.5 px-4 relative overflow-hidden">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 text-xs md:text-sm relative z-10">
          {/* Icon Badge */}
          <span className="bg-white/20 backdrop-blur-sm rounded-full px-2 py-0.5 flex items-center gap-1 font-bold">
            <span className="text-base">🎁</span>
            <span className="hidden sm:inline text-[10px] md:text-xs">NEW</span>
          </span>
          
          {/* Main message */}
          <span className="text-center font-medium">
            <span className="hidden sm:inline">First Order Special:</span>
            <span className="sm:hidden">New Customer:</span>
            {' '}
            <strong className="text-yellow-300 text-sm md:text-base">AED100 OFF</strong>
            {' '}+ Free Shipping
            <span className="hidden md:inline"> on orders above AED499</span>
          </span>
          
          {/* CTA */}
          <button
            onClick={handleClaimClick}
            className="bg-white text-purple-600 px-3 py-1 rounded-full text-[10px] md:text-xs font-bold hover:bg-yellow-300 hover:text-purple-700 transition-all hover:scale-105 shadow-lg"
          >
            Claim Now →
          </button>
          
          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-white/70 hover:text-white hover:bg-white/20 rounded-full transition p-1"
            aria-label="Close notification"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Login Prompt Modal */}
      {showLoginPrompt && (
        <>
          <div 
            className="fixed inset-0 bg-black/60 z-[9998] backdrop-blur-sm animate-fadeIn"
            onClick={() => setShowLoginPrompt(false)}
          />
          
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-slideUp relative">
              <button
                onClick={() => setShowLoginPrompt(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition"
              >
                <X size={24} />
              </button>

              <div className="p-8 text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-5xl">🎁</span>
                </div>

                <h2 className="text-2xl font-bold text-slate-900 mb-2">
                  Welcome Bonus Awaits!
                </h2>
                
                <p className="text-slate-600 mb-6">
                  Sign up now to claim your <strong className="text-purple-600">AED100 OFF</strong> + <strong className="text-purple-600">FREE Shipping</strong> on your first order!
                </p>

                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 mb-6">
                  <div className="space-y-2 text-left text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-slate-700">AED100 instant discount</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-slate-700">Free shipping (Save AED50+)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-slate-700">Exclusive member deals</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={handleSignup}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-xl font-semibold hover:from-purple-700 hover:to-pink-700 transition shadow-lg hover:shadow-xl"
                  >
                    Sign Up & Claim Bonus
                  </button>
                  <button
                    onClick={handleLogin}
                    className="w-full bg-slate-100 text-slate-700 py-3 rounded-xl font-semibold hover:bg-slate-200 transition"
                  >
                    Already have an account? Login
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}

export default TopBarNotification
