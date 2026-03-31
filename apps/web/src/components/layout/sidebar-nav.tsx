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
              'group relative flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
              isActive
                ? 'bg-accent/10 text-foreground'
                : 'text-muted-foreground hover:bg-surface hover:text-foreground',
            )}
          >
            <div className="flex items-center gap-3">
              {Icon ? <Icon className={cn('h-[18px] w-[18px] transition-colors', isActive ? 'text-accent' : 'text-muted-foreground group-hover:text-foreground')} strokeWidth={isActive ? 2 : 1.5} /> : null}
              <span>{item.label}</span>
            </div>
            {item.badge ? <Badge tone={isActive ? 'accent' : 'neutral'} className="text-[10px] px-2 py-0.5">{item.badge}</Badge> : null}
          </Link>
        );
      })}
    </nav>
  );
}
