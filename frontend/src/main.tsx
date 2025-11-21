import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider, SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react'

import './index.css'
import App from './App.tsx'
import { OrgGuard } from './OrgGuard.tsx'

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!clerkPublishableKey) {
  console.warn('Missing VITE_CLERK_PUBLISHABLE_KEY; Clerk will not be initialized.')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {clerkPublishableKey ? (
      <ClerkProvider
        publishableKey={clerkPublishableKey}
        signInUrl="https://meet-sculpin-92.accounts.dev/sign-in"
        signUpUrl="https://meet-sculpin-92.accounts.dev/sign-up"
      >
        <SignedIn>
          <OrgGuard>
            <App />
          </OrgGuard>
        </SignedIn>
        <SignedOut>
          <RedirectToSignIn />
        </SignedOut>
      </ClerkProvider>
    ) : (
      <App />
    )}
  </StrictMode>,
)
