"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React from "react";
import { Badge, Button, Card } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  clearSession, // still used for logout if you keep local session too
  seedStudentsIfEmpty,
  seedSettingsIfEmpty,
  seedEnrollmentsIfEmpty,
  seedTeachersIfEmpty,
  seedRemarkRulesIfEmpty,
} from "@/lib/store";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  ClipboardPenLine,
  FileText,
  BarChart3,
  Settings,
  MessageSquareText,
  Menu,
  X,
} from "lucide-react";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/students", label: "Students", icon: Users },
  { href: "/students/new", label: "Add Student", icon: UserPlus },
  { href: "/marks", label: "Enter Marks", icon: ClipboardPenLine },
  { href: "/report-cards", label: "Report Cards", icon: FileText },
  { href: "/analysis", label: "Performance", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/settings/teachers", label: "Teachers", icon: Users },
  { href: "/settings/remarks", label: "Remarks", icon: MessageSquareText },
];

type Me = { id: string; fullName: string; username: string; role: string };

async function apiGetMe(): Promise<Me | null> {
  try {
    const res = await fetch("/api/auth/me", { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as Me;
  } catch {
    return null;
  }
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [open, setOpen] = React.useState(false);
  const [role, setRole] = React.useState<string>("");

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      const me = await apiGetMe();

      if (cancelled) return;

      if (!me) {
        // If cookie session is missing/expired, go login
        router.replace("/login");
        return;
      }

      setRole(me.role);

      // keep your seeding behavior
      seedSettingsIfEmpty();
      seedStudentsIfEmpty();
      seedEnrollmentsIfEmpty();
      seedTeachersIfEmpty();
      seedRemarkRulesIfEmpty();
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  function logout() {
    // Keep existing behavior; your real auth is cookie-based though.
    clearSession();
    // Optional: if you have /api/auth/logout later, call it.
    router.push("/login");
  }

  const isAdmin = role === "ADMIN";

  // ✅ Hide admin-only nav items for non-admins
  const filteredNav = React.useMemo(() => {
    if (isAdmin) return nav;

    return nav.filter((item) => {
      if (item.href === "/dashboard") return true;
      if (item.href === "/students") return true;
      if (item.href === "/marks") return true;
      if (item.href === "/analysis") return true;

      // hide: add student, report cards, settings, teachers, remarks
      return false;
    });
  }, [isAdmin]);

  const Sidebar = (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-extrabold tracking-tight text-slate-900">
            Zana Christian High School - System
          </div>
          <div className="mt-1">
            <Badge>Mode: {role || "—"}</Badge>
          </div>
        </div>
        <button
          className="md:hidden rounded-xl p-2 hover:bg-slate-100"
          onClick={() => setOpen(false)}
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex flex-col gap-1">
        {filteredNav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-semibold",
                active
                  ? "bg-slate-900 text-white"
                  : "text-slate-700 hover:bg-slate-100"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto">
        <Card className="p-3">
          <div className="text-xs text-slate-500">Signed in as</div>
          <div className="text-sm font-extrabold text-slate-900">
            {role === "ADMIN" ? "Administrator" : "Teacher"}
          </div>
          <div className="mt-3 flex gap-2">
            <Button className="w-full" variant="secondary" onClick={logout}>
              Logout
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* mobile top bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white p-3 md:hidden">
        <button
          className="rounded-xl p-2 hover:bg-slate-100"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="text-sm font-extrabold text-slate-900">ZCHS</div>
        <div className="w-10" />
      </div>

      <div className="mx-auto grid max-w-6xl grid-cols-1 md:grid-cols-[260px_1fr]">
        {/* desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen border-r border-slate-200 bg-white md:block">
          {Sidebar}
        </aside>

        {/* mobile drawer */}
        {open ? (
          <div className="fixed inset-0 z-50 md:hidden">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setOpen(false)}
            />
            <div className="absolute left-0 top-0 h-full w-[85%] max-w-[320px] bg-white shadow-xl">
              {Sidebar}
            </div>
          </div>
        ) : null}

        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
