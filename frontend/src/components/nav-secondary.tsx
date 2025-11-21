"use client"

import * as React from "react"
import { type Icon } from "@tabler/icons-react"
import { useEffect, useState, useMemo } from "react"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const linkMap: Record<string, string> = {
  "Manage Employees": "/manage-employees",
  "Support": "#",
  "Reports": "#",
}

export function NavSecondary({
  items,
  userRole,
  ...props
}: {
  items: {
    title: string
    url: string
    icon: Icon
    adminOnly?: boolean
  }[]
  userRole?: string | null
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  // Check if user is admin - handle both Clerk format (org:admin) and database format (ADMIN)
  const isAdmin = useMemo(() => {
    if (!userRole) {
      console.log('🔍 [NavSecondary] userRole is null/undefined')
      return false
    }
    const role = userRole.toLowerCase()
    const result = role === 'org:admin' || role === 'admin'
    console.log('🔍 [NavSecondary] userRole:', userRole, 'normalized:', role, 'isAdmin:', result)
    return result
  }, [userRole])
  
  const [pathname, setPathname] = useState(
    typeof window !== "undefined" ? window.location.pathname : "/",
  )

  useEffect(() => {
    if (typeof window === "undefined") return
    function handlePopState() {
      setPathname(window.location.pathname)
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            // Hide admin-only items from non-admins
            if (item.adminOnly && !isAdmin) {
              return null
            }
            
            const href = linkMap[item.title] ?? item.url
            const isActive = pathname === href

            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  tooltip={item.title}
                  className={isActive ? "bg-muted text-foreground" : undefined}
                >
                  <a
                    href={href}
                    className="flex items-center gap-2"
                    onClick={(event) => {
                      if (href.startsWith("http")) return
                      event.preventDefault()
                      window.history.pushState({}, "", href)
                      window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }))
                      setPathname(href)
                    }}
                  >
                    {item.icon && <item.icon className="size-4" />}
                    <span>{item.title}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
