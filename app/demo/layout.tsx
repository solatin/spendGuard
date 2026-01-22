"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type TabId = "agent" | "spendguard" | "provider";

const tabs: { id: TabId; href: string; label: string; icon: string; description: string }[] = [
  { id: "agent", href: "/demo/agent", label: "Agent", icon: "🤖", description: "Simulate an autonomous agent" },
  { id: "spendguard", href: "/demo/spendguard", label: "SpendGuard", icon: "🛡️", description: "Internal decision-making view" },
  { id: "provider", href: "/demo/provider", label: "Provider", icon: "📧", description: "Mock email provider" },
];

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  
  const activeTab = tabs.find((tab) => pathname === tab.href) || tabs[0];

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Tab Navigation */}
      <div className="sticky top-16 z-40 border-b border-gray-800 bg-gray-950/95 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 py-3">
            <span className="text-sm text-gray-500 mr-4">View:</span>
            {tabs.map((tab) => {
              const isActive = pathname === tab.href;
              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm transition-all
                    ${
                      isActive
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                        : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 border border-transparent"
                    }
                  `}
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                </Link>
              );
            })}
            <div className="ml-auto text-xs text-gray-500">
              {activeTab.description}
            </div>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="demo-content">
        {children}
      </div>
    </div>
  );
}

