import React from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  backHref?: string;
}

export function PageHeader({ title, description, actions, backHref }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 gap-4">
      <div>
        {backHref && (
          <a
            href={backHref}
            className="text-meta text-accent hover:underline mb-1 inline-block"
          >
            &larr; Back
          </a>
        )}
        <h1 className="text-page font-semibold text-text">{title}</h1>
        {description && <p className="text-meta text-text-muted mt-1">{description}</p>}
      </div>
      {actions && <div className="flex items-center space-x-3">{actions}</div>}
    </div>
  );
}
