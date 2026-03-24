
'use client'
import React, { useRef } from 'react'
import { Provider } from 'react-redux'
import { makeStore } from '../lib/store'

export default function StoreProvider({ children }) {
  const storeRef = useRef(undefined)
  if (!storeRef.current) {
    // Create the store instance the first time this renders
    storeRef.current = makeStore()
  }

  // Rehydrate cart from localStorage on mount
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      console.log('[StoreProvider] Initializing cart from localStorage');
      storeRef.current.dispatch({ type: 'cart/rehydrateCart' });
    }
  }, []);

  return <Provider store={storeRef.current}>{children}</Provider>
}
    