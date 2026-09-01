// =============================================================================
// StatusBadge — Small status indicator
// =============================================================================

type BadgeVariant = "success" | "warning" | "danger" | "info" | "neutral";

interface StatusBadgeProps {
  label: string;
  variant?: BadgeVariant;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  success: "bg-success-50 text-success-700 border-success-500/20",
  warning: "bg-warning-50 text-warning-700 border-warning-500/20",
  danger: "bg-danger-50 text-danger-700 border-danger-500/20",
  info: "bg-info-50 text-info-600 border-info-500/20",
  neutral: "bg-surface-100 text-surface-600 border-surface-300/30",
};

function StatusBadge({ label, variant = "neutral", className = "" }: StatusBadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center
        px-2.5 py-0.5
        text-xs font-medium
        rounded-full border
        ${variantClasses[variant]}
        ${className}
      `.trim()}
    >
      {label}
    </span>
  );
}

export { StatusBadge };
export type { StatusBadgeProps, BadgeVariant };
