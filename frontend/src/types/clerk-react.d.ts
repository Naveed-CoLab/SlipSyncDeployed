declare module '@clerk/clerk-react' {
  import type { ReactNode } from 'react'

  // Minimal shapes needed by App.tsx and OrgGuard.tsx.

  export interface OrganizationResource {
    id: string
    name?: string | null
    publicMetadata?: Record<string, unknown>
  }

  export interface OrganizationMembershipResource {
    organization: OrganizationResource
    role?: string | null
  }

  export interface PaginatedResources<T> {
    data: T[]
  }

  export interface SessionResource {
    getToken(): Promise<string | null>
  }

  export function useSession(): { session: SessionResource | null }
  export function useOrganization(): { organization: OrganizationResource | null }
  export function useOrganizationList(): {
    isLoaded: boolean
    userMemberships?: PaginatedResources<OrganizationMembershipResource>
  }

  // Additional hooks/components used throughout the app

  export interface ClerkEmailAddress {
    emailAddress?: string | null
  }

  export interface ClerkUser {
    fullName?: string | null
    username?: string | null
    primaryEmailAddress?: ClerkEmailAddress | null
    imageUrl?: string | null
  }

  export function useUser(): { user: ClerkUser | null }

  export interface ClerkInstance {
    signOut: () => Promise<void> | void
    openOrganizationProfile?: () => void
    openUserProfile?: () => void
    // allow other properties without strict typing
    [key: string]: unknown
  }

  export function useClerk(): ClerkInstance

  export interface SignedInProps {
    children: ReactNode
  }
  export interface SignedOutProps {
    children: ReactNode
  }

  export function SignedIn(props: SignedInProps): JSX.Element | null
  export function SignedOut(props: SignedOutProps): JSX.Element | null

  export interface RedirectToSignInProps {
    redirectUrl?: string
  }

  export function RedirectToSignIn(props: RedirectToSignInProps): JSX.Element | null

  export interface ClerkProviderProps {
    children: ReactNode
    publishableKey?: string
    signInUrl?: string
    signUpUrl?: string
  }

  export function ClerkProvider(props: ClerkProviderProps): JSX.Element
}



