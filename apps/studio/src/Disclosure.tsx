import { useState } from 'react';
import type { ReactNode } from 'react';

/** Native disclosure semantics and one shared marker for Studio sections. */
export function Disclosure({ title, badge, defaultOpen = false, className = '', children }: {
  title: string; badge?: ReactNode; defaultOpen?: boolean; className?: string; children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return <details className={`studio-disclosure ${className}`} open={open}
    onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>{title}{badge && <span className="disclosure-badge">{badge}</span>}</summary>
    {children}
  </details>;
}
