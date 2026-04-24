import { Suspense } from 'react'
import SignUpClient from './SignUpClient'

export const dynamic = 'force-dynamic'

export default function SignUpPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div>Loading...</div>
      </div>
    }>
      <SignUpClient />
    </Suspense>
  )
}
