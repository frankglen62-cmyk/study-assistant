import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export function SectionCard({
  title,
  subtitle,
  icon: Icon,
  actions,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={className ? `panel-card ${className}` : 'panel-card'}>
      <header className="panel-card__header">
        <div className="panel-card__title-area">
          {Icon && <Icon className="panel-card__icon" size={18} />}
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
        </div>
        {actions ? <div className="panel-card__actions">{actions}</div> : null}
      </header>
      <div className="panel-card__body">{children}</div>
    </section>
  );
}
