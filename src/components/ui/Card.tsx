import type { ReactNode } from "react";

// =============================================================================
// Card — Content container with optional title
// =============================================================================

interface CardProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

function Card({ title, children, className = "" }: CardProps) {
  return (
    <div
      className={`
        bg-white rounded-lg border border-surface-200
        shadow-card hover:shadow-card-hover
        transition-shadow duration-200
        ${className}
      `.trim()}
    >
      {title && (
        <div className="px-5 py-4 border-b border-surface-200">
          <h3 className="text-lg font-semibold text-surface-800">{title}</h3>
        </div>
      )}
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

export { Card };
export type { CardProps };
