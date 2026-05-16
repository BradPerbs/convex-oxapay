import * as React from "react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { Copy01Icon, Tick02Icon, RefreshIcon } from "@hugeicons/core-free-icons";

/** Shared design tokens, kept inline so the example has zero deps. */
export const tokens = {
  color: {
    bg: "#0a0a0a",
    surface: "#111111",
    surfaceAlt: "#1a1a1a",
    border: "#27272a",
    borderStrong: "#3f3f46",
    text: "#fafafa",
    muted: "#a1a1aa",
    primary: "#6366f1",
    primaryHover: "#818cf8",
    success: "#22c55e",
    warning: "#f59e0b",
    danger: "#ef4444",
  },
  radius: 14,
  radiusSm: 10,
  space: (n: number) => `${n * 4}px`,
} as const;

export function Card({
  title,
  description,
  children,
  footer,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: tokens.color.surface,
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius,
        marginBottom: tokens.space(4),
      }}
    >
      {(title || description) && (
        <div
          style={{
            padding: `${tokens.space(5)} ${tokens.space(6)} ${tokens.space(4)}`,
          }}
        >
          {title && (
            <div
              style={{
                fontSize: "0.95rem",
                fontWeight: 600,
                color: tokens.color.text,
                letterSpacing: "-0.01em",
              }}
            >
              {title}
            </div>
          )}
          {description && (
            <div
              style={{
                marginTop: tokens.space(1),
                fontSize: "0.825rem",
                color: tokens.color.muted,
                lineHeight: 1.55,
              }}
            >
              {description}
            </div>
          )}
        </div>
      )}
      <div style={{ padding: `0 ${tokens.space(6)} ${tokens.space(5)}` }}>{children}</div>
      {footer && (
        <div
          style={{
            padding: `${tokens.space(3)} ${tokens.space(6)} ${tokens.space(4)}`,
            borderTop: `1px solid ${tokens.color.border}`,
            fontSize: "0.8rem",
            color: tokens.color.muted,
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "block", marginBottom: tokens.space(3) }}>
      <div
        style={{
          fontSize: "0.8rem",
          fontWeight: 500,
          color: tokens.color.muted,
          marginBottom: tokens.space(1),
        }}
      >
        {label}
      </div>
      {children}
      {hint && (
        <div
          style={{
            marginTop: tokens.space(1),
            fontSize: "0.75rem",
            color: tokens.color.muted,
          }}
        >
          {hint}
        </div>
      )}
    </label>
  );
}

const baseInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.6rem 0.85rem",
  fontSize: "0.875rem",
  background: tokens.color.bg,
  color: tokens.color.text,
  border: `1px solid ${tokens.color.border}`,
  borderRadius: tokens.radiusSm,
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.15s ease, background 0.15s ease",
};

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input(props, ref) {
    return <input ref={ref} {...props} style={{ ...baseInputStyle, ...props.style }} />;
  },
);

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      style={{
        ...baseInputStyle,
        appearance: "none",
        backgroundImage:
          'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2710%27 height=%276%27 viewBox=%270 0 10 6%27%3E%3Cpath d=%27M1 1l4 4 4-4%27 stroke=%27%23a1a1aa%27 stroke-width=%271.5%27 fill=%27none%27 stroke-linecap=%27round%27/%3E%3C/svg%3E")',
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 0.75rem center",
        paddingRight: "2rem",
        ...props.style,
      }}
    />
  );
}

type BtnVariant = "primary" | "ghost" | "danger";
export function Button(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; loading?: boolean },
) {
  const { variant = "primary", loading, children, disabled, ...rest } = props;
  const styles: Record<BtnVariant, React.CSSProperties> = {
    primary: {
      background: tokens.color.primary,
      border: `1px solid ${tokens.color.primary}`,
      color: "white",
    },
    ghost: {
      background: "transparent",
      border: `1px solid ${tokens.color.border}`,
      color: tokens.color.text,
    },
    danger: {
      background: tokens.color.danger,
      border: `1px solid ${tokens.color.danger}`,
      color: "white",
    },
  };
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      style={{
        padding: "0.55rem 1.05rem",
        fontWeight: 600,
        fontSize: "0.85rem",
        borderRadius: tokens.radiusSm,
        cursor: disabled || loading ? "not-allowed" : "pointer",
        opacity: disabled || loading ? 0.55 : 1,
        transition: "opacity 0.15s ease, background 0.15s ease, transform 0.05s ease",
        ...styles[variant],
        ...props.style,
      }}
    >
      {loading ? "…" : children}
    </button>
  );
}

export function Code({ children, block }: { children: React.ReactNode; block?: boolean }) {
  return (
    <code
      style={{
        background: tokens.color.bg,
        border: `1px solid ${tokens.color.border}`,
        borderRadius: block ? tokens.radiusSm : 6,
        padding: block ? "0.6rem 0.85rem" : "0.12rem 0.35rem",
        fontSize: block ? "0.8rem" : "0.75rem",
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
        color: tokens.color.text,
        display: block ? "block" : "inline",
        overflowX: "auto",
        whiteSpace: block ? "pre-wrap" : "nowrap",
        wordBreak: block ? "break-all" : "normal",
      }}
    >
      {children}
    </code>
  );
}

export function Badge({ children, tone }: { children: React.ReactNode; tone?: "success" | "warning" | "danger" | "info" }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    success: { bg: "rgba(34, 197, 94, 0.15)", fg: tokens.color.success },
    warning: { bg: "rgba(245, 158, 11, 0.15)", fg: tokens.color.warning },
    danger: { bg: "rgba(239, 68, 68, 0.15)", fg: tokens.color.danger },
    info: { bg: "rgba(99, 102, 241, 0.15)", fg: tokens.color.primary },
  };
  const t = colors[tone ?? "info"];
  return (
    <span
      style={{
        background: t.bg,
        color: t.fg,
        padding: "0.2rem 0.55rem",
        borderRadius: 999,
        fontSize: "0.68rem",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        display: "inline-flex",
        alignItems: "center",
      }}
    >
      {children}
    </span>
  );
}

export function statusTone(status: string | undefined): "success" | "warning" | "danger" | "info" {
  if (!status) return "info";
  const s = status.toLowerCase();
  if (s === "paid" || s === "confirmed" || s === "manual_accept") return "success";
  if (s === "expired" || s === "failed" || s === "rejected" || s === "canceled") return "danger";
  if (s === "paying" || s === "confirming" || s === "processing" || s === "pending") return "warning";
  return "info";
}

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <Button
      variant="ghost"
      onClick={() => {
        navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      style={{
        padding: "0.35rem 0.65rem",
        fontSize: "0.75rem",
        display: "inline-flex",
        alignItems: "center",
        gap: "0.35rem",
      }}
    >
      <HugeiconsIcon
        icon={copied ? Tick02Icon : Copy01Icon}
        size={14}
        strokeWidth={2}
        color={copied ? tokens.color.success : "currentColor"}
      />
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

/** Small inline icon wrapper for consistent sizing. */
export function Icon({
  icon,
  size = 16,
  color,
  strokeWidth,
}: {
  icon: IconSvgElement;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  return (
    <HugeiconsIcon
      icon={icon}
      size={size}
      strokeWidth={strokeWidth ?? 1.75}
      color={color ?? "currentColor"}
    />
  );
}

export { RefreshIcon };

export function Spinner() {
  return (
    <span
      style={{
        display: "inline-block",
        width: 14,
        height: 14,
        border: `2px solid ${tokens.color.border}`,
        borderTopColor: tokens.color.primary,
        borderRadius: "50%",
        animation: "convex-oxapay-spin 0.6s linear infinite",
      }}
    />
  );
}

export const globalCss = `
@keyframes convex-oxapay-spin { to { transform: rotate(360deg); } }
body {
  background: ${tokens.color.bg};
  color: ${tokens.color.text};
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
* { box-sizing: border-box; }
button { font-family: inherit; }
button:hover:not(:disabled) { filter: brightness(1.1); }
button:active:not(:disabled) { transform: translateY(0.5px); }
input:focus, select:focus { border-color: ${tokens.color.borderStrong}; background: ${tokens.color.surfaceAlt}; }
button:focus-visible, input:focus-visible, select:focus-visible {
  outline: 2px solid ${tokens.color.primary};
  outline-offset: 2px;
}
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: ${tokens.color.border}; border-radius: 5px; }
::-webkit-scrollbar-thumb:hover { background: ${tokens.color.borderStrong}; }
`;
