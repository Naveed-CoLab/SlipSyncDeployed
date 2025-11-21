import type { ComponentProps, ReactNode } from 'react'

import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'

interface LayoutProps {
  children: ReactNode
  sidebarProps?: ComponentProps<typeof AppSidebar>
}

export function Layout({ children, sidebarProps }: LayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-background text-foreground">
        <AppSidebar {...sidebarProps} />
        <main className="flex flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-border px-4 py-2 lg:hidden">
            <SidebarTrigger />
            <span className="text-sm font-medium text-muted-foreground">Menu</span>
          </div>
          {children}
        </main>
      </div>
    </SidebarProvider>
  )
}

