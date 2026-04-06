import type { NavItem } from '@study-assistant/shared-types';

export const publicNavItems: NavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/contact', label: 'Contact' },
];

export const clientNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', iconName: 'dashboard' },
  { href: '/sessions', label: 'Sessions', iconName: 'sessions' },
  { href: '/buy-credits', label: 'Buy Credits', iconName: 'buy_credits' },
  { href: '/usage-logs', label: 'Usage Logs', iconName: 'usage_logs' },
  { href: '/settings', label: 'Settings', iconName: 'settings' },
  { href: '/extension-guide', label: 'Extension Guide', iconName: 'extension_guide' },
];

export const adminNavItems: NavItem[] = [
  { href: '/admin/dashboard', label: 'Dashboard', iconName: 'dashboard' },
  { href: '/admin/announcements', label: 'Announcements', iconName: 'dashboard' },
  { href: '/admin/sources', label: 'Sources', iconName: 'sources' },
  { href: '/admin/subjects', label: 'Subjects', iconName: 'subjects' },
  { href: '/admin/categories', label: 'Categories', iconName: 'categories' },
  { href: '/admin/users', label: 'Users', iconName: 'users' },
  { href: '/admin/payments', label: 'Payments', iconName: 'payments' },
  { href: '/admin/sessions', label: 'Sessions', iconName: 'sessions' },
  { href: '/admin/reports', label: 'Reports', iconName: 'reports' },
  { href: '/admin/audit-logs', label: 'Audit Logs', iconName: 'audit_logs' },
  { href: '/admin/extension-guide', label: 'Extension Guide', iconName: 'extension_guide' },
  { href: '/admin/settings', label: 'Settings', iconName: 'settings' },
];
