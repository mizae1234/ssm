"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  FileText,
  Users,
  Building2,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Shield,
  Package,
  CreditCard,
  Receipt,
  Settings,
  Cloud,
  ShoppingCart,
  FileSpreadsheet,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

interface SubNavItem {
  name: string
  href: string
  icon?: LucideIcon
}

interface NavItem {
  name: string
  href: string
  icon: LucideIcon
  badge?: number
  badgeColor?: string // 'red' | 'blue' (default blue)
  children?: SubNavItem[]
}

interface NavGroup {
  label: string
  items: NavItem[]
}

import React, { useState, useEffect } from 'react'
import type { AuthUser } from './client-layout'

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  user: AuthUser | null;
  stats: { claims: number; invoices: number; payments: number };
}

export default function Sidebar({ collapsed, onToggle, user, stats }: SidebarProps) {
  const pathname = usePathname()
  const role = user?.role || 'STAFF'

  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    '/reports': true,
  })

  // Automatically keep submenus open when route matches
  useEffect(() => {
    if (pathname?.startsWith('/reports')) {
      setOpenMenus(prev => ({ ...prev, '/reports': true }))
    }
  }, [pathname])

  const currentNavGroups: NavGroup[] = [
    {
      label: 'OVERVIEW',
      items: [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      ],
    },
    {
      label: 'OPERATIONS',
      items: [
        { name: 'Claims', href: '/claims', icon: FileText, badge: stats.claims },
        { name: 'Invoices', href: '/invoices', icon: Receipt, badge: stats.invoices, badgeColor: 'red' },
        { name: 'Payments', href: '/payments', icon: CreditCard, badge: stats.payments },
      ],
    },
    {
      label: 'ACCOUNTING',
      items: [
        { name: 'PEAK Sync', href: '/peak', icon: Cloud },
      ],
    },
    {
      label: 'MASTER DATA',
      items: [
        { name: 'Insurances', href: '/insurances', icon: Building2 },
        { name: 'Vendors', href: '/vendors', icon: Users },
        { name: 'Parts Master', href: '/parts-master', icon: Package },
      ],
    },
    {
      label: 'REPORTS',
      items: [
        {
          name: 'Reports',
          href: '/reports',
          icon: BarChart3,
          children: [
            { name: 'ภาพรวมรายงาน', href: '/reports', icon: BarChart3 },
            { name: 'รายงานซื้อ', href: '/reports/purchases', icon: ShoppingCart },
            { name: 'รายงานขาย', href: '/reports/sales', icon: FileSpreadsheet },
          ],
        },
      ],
    },
    {
      label: 'SETTINGS',
      items: [
        { name: 'Settings', href: '/settings', icon: Settings },
      ],
    },
  ]

  const filteredNavGroups = currentNavGroups.map((group) => {
    const items = group.items.filter((item) => {
      if (role === 'STAFF') {
        return !['/invoices', '/payments', '/peak', '/reports', '/settings'].includes(item.href)
      }
      if (role === 'ACCOUNTANT') {
        return !['/claims', '/settings'].includes(item.href)
      }
      return true
    })
    return { ...group, items }
  }).filter((group) => group.items.length > 0)

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-gradient-to-b from-[#0d9488] to-[#115e59] text-white transition-all duration-300 flex flex-col",
        collapsed ? "w-[72px]" : "w-[260px]"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-white/10">
        <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
          <Shield className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div className="animate-fade-in">
            <h1 className="text-base font-bold tracking-tight">SSM</h1>
            <p className="text-[10px] text-[#ccfbf1] font-medium">Management System</p>
          </div>
        )}
      </div>

      {/* Navigation — Grouped */}
      <nav className="flex-1 px-3 py-2 overflow-y-auto">
        {filteredNavGroups.map((group) => (
          <div key={group.label}>
            {/* Group label */}
            {!collapsed && (
              <div className="px-3 pt-4 pb-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-[1px] text-white/40">
                  {group.label}
                </span>
              </div>
            )}
            {collapsed && <div className="pt-3 pb-1 border-t border-white/10 mt-2 first:mt-0 first:border-t-0 first:pt-2" />}

            {/* Group items */}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const hasChildren = Boolean(item.children && item.children.length > 0)
                const isSubOpen = Boolean(openMenus[item.href])
                const isDirectActive = pathname === item.href
                const isChildActive = Boolean(item.children?.some(c => pathname === c.href || (c.href !== '/reports' && pathname?.startsWith(c.href))))
                const isParentActive = isDirectActive || isChildActive

                if (hasChildren && !collapsed) {
                  return (
                    <div key={item.name} className="space-y-0.5">
                      <div className="flex items-center">
                        <Link
                          href={item.href}
                          className={cn(
                            "flex-1 flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group",
                            isParentActive
                              ? "bg-white/15 text-white"
                              : "text-teal-100 hover:bg-white/[0.08] hover:text-white"
                          )}
                        >
                          <item.icon className={cn("w-5 h-5 flex-shrink-0", isParentActive ? "text-white" : "text-teal-200 group-hover:text-white")} />
                          <span className="animate-fade-in flex-1">{item.name}</span>
                        </Link>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setOpenMenus(prev => ({ ...prev, [item.href]: !isSubOpen }))
                          }}
                          className="p-2 text-teal-200 hover:text-white rounded-md hover:bg-white/10 transition-colors mr-1"
                          aria-label="Toggle submenu"
                        >
                          <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", isSubOpen ? "rotate-180" : "")} />
                        </button>
                      </div>

                      {/* Submenu items */}
                      {isSubOpen && (
                        <div className="ml-5 pl-3 border-l border-white/20 space-y-1 py-1 animate-in fade-in slide-in-from-top-1 duration-150">
                          {item.children?.map((child) => {
                            const isThisChildActive = child.href === '/reports'
                              ? pathname === '/reports'
                              : pathname === child.href || pathname?.startsWith(child.href + '/')

                            return (
                              <Link
                                key={child.name}
                                href={child.href}
                                className={cn(
                                  "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-150",
                                  isThisChildActive
                                    ? "bg-white/25 text-white font-semibold shadow-sm"
                                    : "text-teal-100 hover:bg-white/10 hover:text-white"
                                )}
                              >
                                {child.icon ? (
                                  <child.icon className={cn("w-3.5 h-3.5 flex-shrink-0", isThisChildActive ? "text-white" : "text-teal-200")} />
                                ) : (
                                  <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", isThisChildActive ? "bg-white" : "bg-teal-300")} />
                                )}
                                <span>{child.name}</span>
                              </Link>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                }

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group",
                      isParentActive
                        ? "bg-white/15 text-white"
                        : "text-teal-100 hover:bg-white/[0.08] hover:text-white"
                    )}
                  >
                    <item.icon className={cn("w-5 h-5 flex-shrink-0", isParentActive ? "text-white" : "text-teal-200 group-hover:text-white")} />
                    {!collapsed && (
                      <span className="animate-fade-in flex-1">{item.name}</span>
                    )}
                    {!collapsed && item.badge !== undefined && item.badge > 0 && (
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full animate-fade-in",
                        item.badgeColor === 'red'
                          ? "bg-red-500 text-white"
                          : "bg-white/25 text-white"
                      )}>
                        {item.badge}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="px-3 py-3 border-t border-white/10">
        <button
          onClick={onToggle}
          className="flex items-center justify-center w-full py-2 rounded-lg text-teal-200 hover:text-white hover:bg-white/10 transition-all duration-200"
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          {!collapsed && <span className="ml-2 text-sm font-medium">ย่อเมนู</span>}
        </button>
      </div>
    </aside>
  )
}
