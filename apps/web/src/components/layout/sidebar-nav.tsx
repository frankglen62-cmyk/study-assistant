'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Activity,
  BookOpen,
  CreditCard,
  FileText,
  HelpCircle,
  History,
  LayoutDashboard,
  Library,
  PieChart,
  Settings,
  ShieldCheck,
  ShoppingBag,
  User,
  Users,
} from 'lucide-react';

import type { NavItem } from '@study-assistant/shared-types';
import { Badge, cn } from '@study-assistant/ui';

const iconMap = {
  dashboard: LayoutDashboard,
  sessions: History,
  buy_credits: ShoppingBag,
  usage_logs: Activity,
  settings: Settings,
  account: User,
  extension_guide: HelpCircle,
  sources: FileText,
  subjects: BookOpen,
  categories: Library,
  users: Users,
  payments: CreditCard,
  reports: PieChart,
  audit_logs: ShieldCheck,
} as const;

export function SidebarNav({
  items,
  currentPath,
}: {
  items: NavItem[];
  currentPath: string;
}) {
  const router = useRouter();

  return (
    <nav className="space-y-1">
      {items.map((item) => {
        const isActive = currentPath === item.href;
        const Icon = item.iconName ? iconMap[item.iconName] : null;

        return (
          <Link
            key={item.href}
            href={item.href as any}
            onMouseEnter={() => router.prefetch(item.href as any)}
            onFocus={() => router.prefetch(item.href as any)}
            className={cn(
              'group relative flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-300',
              isActive
                ? 'bg-gradient-to-r from-accent/15 to-transparent text-foreground shadow-[inset_2px_0_0_0_hsl(var(--accent))] border border-accent/10'
                : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
            )}
          >
            <div className="flex items-center gap-3">
              {Icon ? <Icon className={cn('h-5 w-5 transition-colors duration-300', isActive ? 'text-accent' : 'text-muted-foreground group-hover:text-foreground')} strokeWidth={isActive ? 2.5 : 2} /> : null}
              <span className={cn('transition-all', isActive && 'font-semibold tracking-wide')}>{item.label}</span>
            </div>
            {item.badge ? <Badge tone={isActive ? 'neutral' : 'accent'} className="bg-background/40">{item.badge}</Badge> : null}
          </Link>
        );
      })}
    </nav>
  );
}
