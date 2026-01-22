"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Home", icon: "◉" },
  { href: "/demo", label: "Demo", icon: "▶" },
  { href: "/test", label: "Test Console", icon: "⚡" },
  { href: "/dashboard", label: "Dashboard", icon: "◈" },
  { href: "/logs", label: "Logs", icon: "☰" },
];

export default function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-emerald-900/30 bg-zinc-950/95 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/30">
              <span className="text-emerald-400 font-mono text-lg">$</span>
            </div>
            <span className="font-mono text-lg font-semibold text-zinc-100 tracking-tight">
              SpendGuard
            </span>
          </Link>

          {/* Nav Links */}
          <div className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || 
                (item.href === "/demo" && pathname.startsWith("/demo"));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm transition-all
                    ${
                      isActive
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                    }
                  `}
                >
                  <span className="text-xs">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
