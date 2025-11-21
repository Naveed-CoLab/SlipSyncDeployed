import { useEffect } from "react";
import { useOrganizationList } from "@clerk/clerk-react";

const CREATE_ORG_URL =
  "https://meet-sculpin-92.accounts.dev/create-organization?redirect_url=http%3A%2F%2Flocalhost%3A5173%2F";

export function OrgGuard({ children }: { children: React.ReactNode }) {
  const { isLoaded, userMemberships } = useOrganizationList();

  useEffect(() => {
    // Wait until everything is loaded properly
    if (!isLoaded) return;

    // If memberships is undefined, do nothing until Clerk resolves it
    if (!userMemberships) return;

    // If truly no organization exists, redirect ONCE
    if (userMemberships.length === 0) {
      window.location.replace(CREATE_ORG_URL);
    }
  }, [isLoaded, userMemberships]);

  // Do not render until everything is loaded
  if (!isLoaded || !userMemberships) return null;

  // When user has no organization, return null (redirect already happened)
  if (userMemberships.length === 0) return null;

  // Otherwise, render the protected content
  return <>{children}</>;
}
