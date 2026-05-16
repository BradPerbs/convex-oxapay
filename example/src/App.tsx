import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  CodeSquareIcon,
  Invoice03Icon,
  Clock01Icon,
  ChartLineData01Icon,
  Wallet02Icon,
  ArrowUpRight01Icon,
  Logout01Icon,
  CheckmarkCircle02Icon,
  GithubIcon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { api } from "../convex/_generated/api.js";
import { Button, Icon, Input, globalCss, tokens } from "./ui.js";
import { PayTab } from "./tabs/PayTab.js";
import { WhiteLabelTab } from "./tabs/WhiteLabelTab.js";
import { WalletTab } from "./tabs/WalletTab.js";
import { PayoutTab } from "./tabs/PayoutTab.js";
import { MarketTab } from "./tabs/MarketTab.js";
import { HistoryTab } from "./tabs/HistoryTab.js";

const STORAGE_KEY = "convex-oxapay-demo-email";

type TabKey = "pay" | "whitelabel" | "wallet" | "payout" | "market" | "history";

const TABS: { key: TabKey; label: string; icon: IconSvgElement; description: string }[] = [
  { key: "pay", label: "Hosted invoice", icon: Invoice03Icon, description: "Redirect to pay.oxapay.com" },
  { key: "whitelabel", label: "White-label", icon: CodeSquareIcon, description: "Render your own checkout" },
  { key: "wallet", label: "Wallet", icon: Wallet02Icon, description: "Static deposit address" },
  { key: "payout", label: "Payout", icon: ArrowUpRight01Icon, description: "Withdraw to an address" },
  { key: "market", label: "Market", icon: ChartLineData01Icon, description: "Prices, currencies, status" },
  { key: "history", label: "History", icon: Clock01Icon, description: "All payments" },
];

export function App() {
  const [email, setEmail] = useState<string>(
    () => (typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY)) || "",
  );
  const [emailDraft, setEmailDraft] = useState("");
  const [tab, setTab] = useState<TabKey>("pay");

  const getOrCreateUser = useMutation(api.users.getOrCreateByEmail);
  const user = useQuery(api.users.getByEmail, email ? { email } : "skip");

  // Sliding sidebar pill
  const navRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [pillStyle, setPillStyle] = useState<{ top: number; height: number; visible: boolean }>({
    top: 0,
    height: 0,
    visible: false,
  });
  const [hasMounted, setHasMounted] = useState(false);

  useLayoutEffect(() => {
    const btn = tabRefs.current[tab];
    if (!btn || !navRef.current) return;
    const navRect = navRef.current.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    setPillStyle({
      top: btnRect.top - navRect.top,
      height: btnRect.height,
      visible: true,
    });
    // Defer enabling the transition until after the first paint so the pill
    // appears in place instead of sliding in from the top.
    requestAnimationFrame(() => setHasMounted(true));
  }, [tab]);

  useEffect(() => {
    if (email) localStorage.setItem(STORAGE_KEY, email);
  }, [email]);

  const onSubmitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = emailDraft.trim();
    if (!trimmed) return;
    await getOrCreateUser({ name: trimmed.split("@")[0], email: trimmed });
    setEmail(trimmed);
  };

  const onSignOut = () => {
    localStorage.removeItem(STORAGE_KEY);
    setEmail("");
    setTab("pay");
  };

  if (!email) {
    return (
      <>
        <style>{globalCss}</style>
        <main
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: tokens.space(6),
          }}
        >
          <div style={{ maxWidth: 540, width: "100%", textAlign: "center" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: tokens.space(5),
                marginBottom: tokens.space(8),
              }}
            >
              <img
                src="/oxapay.svg"
                alt="OxaPay"
                style={{ height: 40, opacity: 0.92 }}
              />
              <span
                style={{
                  color: tokens.color.muted,
                  fontSize: "1.5rem",
                  fontWeight: 300,
                }}
              >
                ×
              </span>
              <img
                src="/convex.webp"
                alt="Convex"
                style={{ height: 40, opacity: 0.92 }}
              />
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: "3rem",
                letterSpacing: "-0.03em",
                lineHeight: 1.05,
                fontWeight: 600,
              }}
            >
              Crypto payments
              <br />
              <span style={{ color: tokens.color.muted }}>for Convex.</span>
            </h1>

            <p
              style={{
                marginTop: tokens.space(4),
                marginBottom: tokens.space(8),
                color: tokens.color.muted,
                fontSize: "1.05rem",
                lineHeight: 1.5,
              }}
            >
              Invoices, wallets, and payouts in your Convex backend. Try the demo.
            </p>

            <form
              onSubmit={onSubmitEmail}
              style={{
                display: "flex",
                gap: tokens.space(2),
                maxWidth: 420,
                margin: "0 auto",
              }}
            >
              <Input
                type="email"
                value={emailDraft}
                onChange={(e) => setEmailDraft(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
                style={{ fontSize: "1rem", padding: "0.85rem 1rem" }}
              />
              <Button
                type="submit"
                style={{ fontSize: "1rem", padding: "0.85rem 1.4rem" }}
              >
                Continue
              </Button>
            </form>
            <div
              style={{
                marginTop: tokens.space(3),
                fontSize: "0.75rem",
                color: tokens.color.muted,
                textAlign: "center",
              }}
            >
              Used only as your demo identity.
            </div>

            <a
              href="https://github.com/bradperbs/convex-oxapay"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                marginTop: tokens.space(6),
                display: "inline-flex",
                alignItems: "center",
                gap: tokens.space(2),
                color: tokens.color.muted,
                fontSize: "0.8rem",
                textDecoration: "none",
                transition: "color 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = tokens.color.text;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = tokens.color.muted;
              }}
            >
              <Icon icon={GithubIcon} size={14} />
              View on GitHub
            </a>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <style>{globalCss}</style>
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          gridTemplateColumns: "240px 1fr",
        }}
      >
        {/* Sidebar */}
        <aside
          style={{
            background: tokens.color.surface,
            borderRight: `1px solid ${tokens.color.border}`,
            padding: tokens.space(5),
            display: "flex",
            flexDirection: "column",
            gap: tokens.space(2),
            position: "sticky",
            top: 0,
            height: "100vh",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: tokens.space(3),
              marginBottom: tokens.space(6),
              padding: `${tokens.space(2)} ${tokens.space(3)}`,
            }}
          >
            <img src="/oxapay.svg" alt="OxaPay" style={{ height: 22, opacity: 0.92 }} />
            <span
              style={{
                color: tokens.color.muted,
                fontSize: "0.95rem",
                fontWeight: 300,
              }}
            >
              ×
            </span>
            <img src="/convex.webp" alt="Convex" style={{ height: 22, opacity: 0.92 }} />
          </div>

          <nav
            ref={navRef}
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              gap: tokens.space(1),
            }}
          >
            {/* Sliding selection pill */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: pillStyle.top,
                height: pillStyle.height,
                background: tokens.color.surfaceAlt,
                borderRadius: tokens.radiusSm,
                opacity: pillStyle.visible ? 1 : 0,
                transition: hasMounted
                  ? "top 0.28s cubic-bezier(0.32, 0.72, 0, 1), height 0.28s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.15s ease"
                  : "opacity 0.15s ease",
                pointerEvents: "none",
                zIndex: 0,
              }}
            />
            {TABS.map((t) => (
              <button
                key={t.key}
                ref={(el) => {
                  tabRefs.current[t.key] = el;
                }}
                onClick={() => setTab(t.key)}
                style={{
                  position: "relative",
                  zIndex: 1,
                  display: "flex",
                  alignItems: "center",
                  gap: tokens.space(3),
                  padding: `${tokens.space(2)} ${tokens.space(3)}`,
                  border: "none",
                  borderRadius: tokens.radiusSm,
                  background: "transparent",
                  color: tab === t.key ? tokens.color.text : tokens.color.muted,
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "color 0.2s ease",
                }}
              >
                <Icon icon={t.icon} size={18} strokeWidth={1.75} />
                <span>{t.label}</span>
              </button>
            ))}
          </nav>

          <div style={{ flex: 1 }} />

          <div
            style={{
              padding: tokens.space(3),
              border: `1px solid ${tokens.color.border}`,
              borderRadius: tokens.radius,
              background: tokens.color.surfaceAlt,
            }}
          >
            <div style={{ fontSize: "0.7rem", color: tokens.color.muted, marginBottom: tokens.space(1) }}>
              Signed in as
            </div>
            <div style={{ fontSize: "0.8rem", overflow: "hidden", textOverflow: "ellipsis" }}>
              {email}
            </div>
            {user?.isPremium && (
              <div
                style={{
                  marginTop: tokens.space(1),
                  fontSize: "0.7rem",
                  color: tokens.color.success,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.25rem",
                }}
              >
                <Icon icon={CheckmarkCircle02Icon} size={12} color={tokens.color.success} />
                Premium (paid)
              </div>
            )}
            <Button
              variant="ghost"
              onClick={onSignOut}
              style={{
                marginTop: tokens.space(2),
                width: "100%",
                padding: "0.3rem 0.5rem",
                fontSize: "0.75rem",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.35rem",
              }}
            >
              <Icon icon={Logout01Icon} size={12} />
              Switch user
            </Button>
          </div>

          <a
            href="https://github.com/bradperbs/convex-oxapay"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: tokens.space(2),
              marginTop: tokens.space(2),
              padding: "0.55rem 0.85rem",
              background: "transparent",
              border: `1px solid ${tokens.color.border}`,
              borderRadius: tokens.radiusSm,
              color: tokens.color.text,
              fontSize: "0.8rem",
              fontWeight: 500,
              textDecoration: "none",
              cursor: "pointer",
              transition: "background 0.15s ease, border-color 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = tokens.color.surfaceAlt;
              e.currentTarget.style.borderColor = tokens.color.borderStrong;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.borderColor = tokens.color.border;
            }}
          >
            <Icon icon={GithubIcon} size={16} />
            View on GitHub
          </a>
        </aside>

        {/* Main */}
        <main style={{ padding: tokens.space(8), maxWidth: 960, width: "100%" }}>
          <header style={{ marginBottom: tokens.space(6), display: "flex", alignItems: "center", gap: tokens.space(3) }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: tokens.radius,
                background: tokens.color.surfaceAlt,
                border: `1px solid ${tokens.color.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon icon={TABS.find((t) => t.key === tab)!.icon} size={22} color={tokens.color.primary} />
            </div>
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: "1.5rem",
                  letterSpacing: "-0.015em",
                  fontWeight: 600,
                }}
              >
                {TABS.find((t) => t.key === tab)?.label}
              </h1>
              <p
                style={{
                  margin: 0,
                  marginTop: "2px",
                  color: tokens.color.muted,
                  fontSize: "0.875rem",
                }}
              >
                {TABS.find((t) => t.key === tab)?.description}
              </p>
            </div>
          </header>

          {tab === "pay" && <PayTab email={email} />}
          {tab === "whitelabel" && <WhiteLabelTab email={email} />}
          {tab === "wallet" && <WalletTab email={email} />}
          {tab === "payout" && <PayoutTab email={email} />}
          {tab === "market" && <MarketTab />}
          {tab === "history" && <HistoryTab email={email} />}
        </main>
      </div>
    </>
  );
}
