"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { InboxIcon, LayoutDashboardIcon, MegaphoneIcon, RadarIcon, UsersIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Přehled", icon: LayoutDashboardIcon },
  { href: "/leads", label: "Leady", icon: UsersIcon },
  { href: "/scraper", label: "Scraper", icon: RadarIcon },
  { href: "/campaigns", label: "Kampaně", icon: MegaphoneIcon },
  { href: "/inbox", label: "Inbox", icon: InboxIcon },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r bg-sidebar px-3 py-5 md:flex">
      <Link href="/" className="mb-6 px-2 text-lg font-semibold tracking-tight">
        Outreach<span className="text-muted-foreground">CRM</span>
      </Link>
      <nav className="flex flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                active ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-sidebar-accent/60",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto border-b px-4 py-2 md:hidden">
      {NAV.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "rounded-md px-2 py-1 text-sm whitespace-nowrap",
            (href === "/" ? pathname === "/" : pathname.startsWith(href)) ? "bg-muted font-medium" : "text-muted-foreground",
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
