import { type ComponentType, useEffect, useState, useMemo } from "react"
import { useSession } from "@clerk/clerk-react"

import { IconCirclePlusFilled } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const linkMap: Record<string, string> = {
  Dashboard: "/",
  Products: "/products",
  Orders: "/orders",
  Invoices: "/invoices",
  "Order Processing": "/pos",
  Customers: "/customers",
  "Manage Employees": "/manage-employees",
}

export function NavMain({
  items,
  userRole,
}: {
  items: {
    title: string
    url: string
    icon?: ComponentType<{ className?: string }>
  }[]
  userRole?: string | null
}) {
  // Check if user is admin - handle both Clerk format (org:admin) and database format (ADMIN)
  const isAdmin = useMemo(() => {
    if (!userRole) {
      return false
    }
    const role = userRole.toLowerCase()
    return role === 'org:admin' || role === 'admin'
  }, [userRole])
  
  const { session } = useSession()
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [name, setName] = useState("")
  const [address, setAddress] = useState("")
  const [phone, setPhone] = useState("")
  const [currency, setCurrency] = useState("PKR")
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!session || !name.trim()) return

    const token = await session.getToken()
    if (!token) return

    setIsSubmitting(true)
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080"
      await fetch(`${baseUrl}/api/stores`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          address: address.trim(),
          phone: phone.trim(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          currency: currency.trim() || "PKR",
        }),
      })

      setIsOpen(false)
      setName("")
      setAddress("")
      setPhone("")
      setCurrency("PKR")

      window.dispatchEvent(new CustomEvent("slipsync:store-created"))
    } catch (e) {
      alert("Failed to create store. Check console for details.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <SidebarGroup>
        <SidebarGroupContent className="flex flex-col gap-2">
          {isAdmin && (
            <SidebarMenu>
              <SidebarMenuItem className="flex items-center gap-2">
                <SidebarMenuButton
                  tooltip="Create Store"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground min-w-8 duration-200 ease-linear"
                  onClick={() => setIsOpen(true)}
                >
                  <IconCirclePlusFilled />
                  <span>Create Store</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          )}
          <SidebarMenu>
            {items.map((item) => {
              const href = linkMap[item.title] ?? "#"
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

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Create store</SheetTitle>
          </SheetHeader>
          <form className="flex flex-1 flex-col gap-4 px-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="store-name">Store name</Label>
              <Input
                id="store-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Main Branch"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="store-address">Address</Label>
              <Input
                id="store-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street, city"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="store-phone">Phone</Label>
              <Input
                id="store-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+92 ..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="store-currency">Currency</Label>
              <Input
                id="store-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                placeholder="PKR"
              />
            </div>
            <SheetFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create store"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  )
}
