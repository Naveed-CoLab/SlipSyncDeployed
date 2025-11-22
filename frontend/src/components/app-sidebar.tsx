import * as React from "react"
import {
  IconDashboard,
  IconDatabase,
  IconFileInvoice,
  IconHelp,
  IconInnerShadowTop,
  IconListDetails,
  IconPackage,
  IconReport,
  IconUsersGroup,
} from "@tabler/icons-react"
import { BadgeCheckIcon } from "lucide-react"

import { useOrganization, useUser } from "@clerk/clerk-react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

import { SidebarStoreSwitcher } from "@/components/sidebar-store-switcher"
import { Badge } from "@/components/ui/badge"
import type { StoreSummary } from "@/types/store"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const data = {
  navMain: [
    {
      title: "Dashboard",
      url: "#",
      icon: IconDashboard,
    },
    {
      title: "Products",
      url: "#",
      icon: IconPackage,
    },
    {
      title: "Orders",
      url: "#",
      icon: IconListDetails,
    },
    {
      title: "Order Processing",
      url: "#",
      icon: IconDatabase,
    },
    {
      title: "Invoices",
      url: "#",
      icon: IconFileInvoice,
    },
    {
      title: "Customers",
      url: "#",
      icon: IconUsersGroup,
    },
  ],
  navSecondary: [
    {
      title: "Manage Employees",
      url: "#",
      icon: IconUsersGroup,
      adminOnly: true,
    },
    {
      title: "Manage Stores",
      url: "#",
      icon: IconDatabase,
      adminOnly: true,
    },
    {
      title: "Support",
      url: "#",
      icon: IconHelp,
    },
    {
      title: "Reports",
      url: "#",
      icon: IconReport,
    },
  ],
}

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  stores?: StoreSummary[]
  activeStoreId?: string | null
  onSelectStore?(storeId: string): void
  storesLoading?: boolean
  userRole?: string | null
}

export function AppSidebar({
  stores,
  activeStoreId,
  onSelectStore,
  storesLoading,
  userRole,
  ...props
}: AppSidebarProps) {
  const { user } = useUser()
  const { organization } = useOrganization()

  const orgVerified = organization?.publicMetadata?.verified !== false

  const currentUser = React.useMemo(() => {
    const base = {
            name:
        user?.fullName ||
        user?.username ||
        user?.primaryEmailAddress?.emailAddress ||
              "User",
      email: user?.primaryEmailAddress?.emailAddress || "",
      avatar: user?.imageUrl || "",
            orgName: organization?.name || "",
          }

    return base
  }, [user, organization?.name])

  const orgName = organization?.name || "SlipSync"

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <a
                href="https://meet-sculpin-92.accounts.dev/organization"
                target="_blank"
                rel="noreferrer"
              >
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2">
                <IconInnerShadowTop className="!size-5" />
                        <div className="flex flex-col">
                <span className="text-base font-semibold">{orgName}</span>
                         
                        </div>
                        {orgVerified && (
                          <Badge variant="secondary" className="ml-auto h-5 gap-1 px-2 text-xs">
                            <BadgeCheckIcon className="size-3" />
                            Verified
                          </Badge>
                        )}
                      </div>
                    </TooltipTrigger>
                    {orgVerified && (
                      <TooltipContent>
                        <p>Verified by SlipSync & Clerk</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {stores && onSelectStore && (
          <div className="px-2 pb-2">
            <SidebarStoreSwitcher
              stores={stores}
              activeStoreId={activeStoreId ?? null}
              onSelect={onSelectStore}
              isLoading={storesLoading ?? false}
            />
          </div>
        )}
        <NavMain items={data.navMain} userRole={userRole} />
        <NavSecondary items={data.navSecondary} className="mt-auto" userRole={userRole} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={currentUser} />
      </SidebarFooter>
    </Sidebar>
  )
}
