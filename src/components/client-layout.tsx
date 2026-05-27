"use client"

import Sidebar from "@/components/sidebar"
import Topbar from "@/components/topbar"
import { ToastProvider } from "@/components/toast-provider"
import { usePathname } from "next/navigation"

import { useState, useEffect } from "react"

export interface AuthUser {
  name: string
  role: string
  username: string
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [stats, setStats] = useState({ claims: 0, invoices: 0, payments: 0 })

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.user) setUser(data.user)
      })
      .catch(console.error)
  }, [])

  useEffect(() => {
    // Only fetch stats for app pages (not public pages)
    if (pathname === '/' || pathname === '/login' || (pathname && (pathname.includes('/pdf') || pathname.includes('/print-')))) {
      return
    }
    
    fetch('/api/stats')
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          setStats({
            claims: data.claims || 0,
            invoices: data.invoices || 0,
            payments: data.payments || 0
          })
        }
      })
      .catch(console.error)
  }, [pathname])

  // Full-screen pages (no sidebar)
  if (pathname === '/' || pathname === '/login' || (pathname && (pathname.includes('/pdf') || pathname.includes('/print-')))) {
    return <ToastProvider>{children}</ToastProvider>
  }

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-[#f8faff]">
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} user={user} stats={stats} />
        <div className={`flex-1 transition-all duration-300 ${sidebarCollapsed ? 'ml-[72px]' : 'ml-[260px]'}`}>
          <Topbar user={user} />
          <main className="p-6">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}
