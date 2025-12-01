import type { ReactNode } from "react"
import { useOrganizationList } from "@clerk/clerk-react"

/**
 * OrgGuard now only waits until Clerk has loaded organization data,
 * and then always renders children. We no longer force a redirect
 * to "create organization" to avoid redirect loops and incorrect prompts.
 */
export function OrgGuard({ children }: { children: ReactNode }) {
  const { isLoaded } = useOrganizationList()

  // Do not render until Clerk has fully loaded
  if (!isLoaded) return null

  return <>{children}</>
}
