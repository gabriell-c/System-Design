"use client";

import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

type Props = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export default function PanelEmpty({ icon: Icon = Inbox, title, description, action }: Props) {
  return (
    <div className="panel-empty">
      <div className="panel-empty-icon">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-sm font-medium text-[var(--muted)]">{title}</p>
      {description && <p className="panel-hint max-w-[220px]">{description}</p>}
      {action}
    </div>
  );
}
