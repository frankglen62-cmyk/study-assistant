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
              'group relative flex items-center justify-between border-2 border-transparent px-4 py-3 text-sm font-bold uppercase tracking-wider transition-all duration-150',
              isActive
                ? 'border-border bg-accent text-black shadow-solid-sm translate-x-1'
                : 'text-muted-foreground hover:border-border hover:bg-surface hover:text-foreground hover:translate-x-1',
            )}
          >
            <div className="flex items-center gap-4">
              {Icon ? <Icon className={cn('h-5 w-5 transition-colors', isActive ? 'text-black' : 'text-muted-foreground group-hover:text-foreground')} strokeWidth={isActive ? 3 : 2} /> : null}
              <span className={cn('transition-all', isActive && 'font-black')}>{item.label}</span>
            </div>
            {item.badge ? <Badge tone={isActive ? 'neutral' : 'accent'} className="rounded-none border-2 border-border bg-background px-2 font-bold text-foreground">{item.badge}</Badge> : null}
          </Link>
        );
      })}
    </nav>
  );
}
