"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Stethoscope, LogOut, ChevronRight, HelpCircle } from "lucide-react";
import { navConfig, isNavGroup, NavGroup } from "@/lib/nav-config";
import { useAuth } from "@/lib/auth-context";
import { useTour } from "@/lib/tour-context";
import AiAssistantPanel from "@/components/AiAssistantPanel";
import WalkthroughTour from "@/components/WalkthroughTour";

function initials(email: string) {
    return email.slice(0, 2).toUpperCase();
}

// A nav path is "active" for a given href if it's an exact match or a
// sub-route of it (pathname.startsWith(href) alone would also match a
// sibling item whose href happens to be a prefix, e.g. "/appointments" is a
// prefix of "/appointments/audit-log").
function matchesNavHref(pathname: string, href: string): boolean {
    return pathname === href || pathname.startsWith(`${href}/`);
}

function findCrumb(pathname: string): string {
    for (const entry of navConfig) {
        if (isNavGroup(entry)) {
            const match = entry.items.find((i) => matchesNavHref(pathname, i.href));
            if (match) return `${entry.label} / ${match.label}`;
        } else if (matchesNavHref(pathname, entry.href)) {
            return entry.label;
        }
    }
    return "Dashboard";
}

function NavGroupSection({ group, pathname }: { group: NavGroup; pathname: string }) {
    const containsActive = group.items.some((i) => matchesNavHref(pathname, i.href));
    const [open, setOpen] = useState(containsActive);
    const GroupIcon = group.icon;

    return (
        <div className="navGroup">
            <button className="navGroupToggle" onClick={() => setOpen((o) => !o)}>
                <span className="navGroupLabel">
                    <span className="navGroupIcon"><GroupIcon size={18} /></span>{group.label}
                </span>
                <ChevronRight size={14} className={`navGroupChevron ${open ? "open" : ""}`} />
            </button>
            {open && (
                <div className="navGroupItems">
                    {group.items.map((item) => {
                        const ItemIcon = item.icon;
                        const active = matchesNavHref(pathname, item.href);
                        return (
                            <Link key={item.href} href={item.href} className={active ? "active" : ""}>
                                <span><ItemIcon size={15} /></span>{item.label}
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default function AppShell({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const { user, signOut } = useAuth();
    const { startTour, hasCompletedTour } = useTour();

    useEffect(() => {
        if (!hasCompletedTour()) {
            const timer = setTimeout(() => startTour(), 700);
            return () => clearTimeout(timer);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="app">
            <aside>
                <div className="brand">
                    <span className="tooth"><Stethoscope size={20} className="iconShimmer" /></span>
                    <div>
                        <strong>DentiGO</strong>
                        <small>Dental Care Platform</small>
                    </div>
                </div>
                <nav>
                    {navConfig.map((entry) =>
                        isNavGroup(entry) ? (
                            <NavGroupSection key={entry.label} group={entry} pathname={pathname} />
                        ) : (
                            <Link
                                key={entry.href}
                                href={entry.href}
                                className={matchesNavHref(pathname, entry.href) ? "active" : ""}
                            >
                                <span><entry.icon size={18} /></span>{entry.label}
                            </Link>
                        )
                    )}
                </nav>
                <div className="sideBottom">
                    <button onClick={() => signOut()}>
                        <span><LogOut size={18} /></span>Logout
                    </button>
                </div>
            </aside>

            <main>
                <header>
                    <div className="crumb">DentiGO <span>/</span> {findCrumb(pathname)}</div>
                    <div className="tools">
                        <button className="helpBtn" type="button" onClick={startTour} aria-label="Take the walkthrough" title="Take the walkthrough">
                            <HelpCircle size={18} />
                        </button>
                        <button className="profile" type="button">
                            <span>{initials(user?.email || "A")}</span>
                            <div>
                                <strong>{user?.email?.split("@")[0] || "Admin"}</strong>
                                <small>{user?.email}</small>
                            </div>
                        </button>
                    </div>
                </header>

                <section className="content routeFade" key={pathname}>
                    {children}
                </section>
            </main>

            <AiAssistantPanel />
            <WalkthroughTour />
        </div>
    );
}
