import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { RefreshIcon } from "@hugeicons/core-free-icons";
import { api } from "../../convex/_generated/api.js";
import { Badge, Button, Card, Icon, tokens } from "../ui.js";

function extractError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/generalApiKey/i.test(msg)) return "OXAPAY_GENERAL_API_KEY not configured.";
  if (/payoutApiKey/i.test(msg)) return "OXAPAY_PAYOUT_API_KEY not configured.";
  if (/merchantApiKey/i.test(msg)) return "OXAPAY_MERCHANT_API_KEY not configured.";
  const oxa = msg.match(/OxaPay API error \(\d+\)[^:]*:\s*(.+?)(\n|$)/);
  if (oxa) return oxa[1].trim();
  return msg;
}

export function MarketTab() {
  const getPrices = useAction(api.market.prices);
  const getMonitor = useAction(api.market.monitor);
  const getBalance = useAction(api.market.balance);

  const [prices, setPrices] = useState<Record<string, number> | null>(null);
  const [monitor, setMonitor] = useState<{ status: any } | null>(null);
  const [balance, setBalance] = useState<Record<string, { available: number; pending: number }> | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setBalanceError(null);
    try {
      const [p, m] = await Promise.all([getPrices(), getMonitor()]);
      setPrices(p);
      setMonitor(m);
    } finally {
      setLoading(false);
    }
    try {
      setBalance(await getBalance());
    } catch (e) {
      setBalance(null);
      setBalanceError(extractError(e));
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <Card
        title={
          <span style={{ display: "flex", alignItems: "center", gap: tokens.space(2) }}>
            Prices
            {monitor && (
              <Badge tone={monitor.status === "OK" || monitor.status === true ? "success" : "danger"}>
                System {String(monitor.status)}
              </Badge>
            )}
          </span>
        }
      >
        <div style={{ marginBottom: tokens.space(3) }}>
          <Button
            variant="ghost"
            onClick={refresh}
            disabled={loading}
            style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
          >
            <Icon icon={RefreshIcon} size={14} />
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
        {!prices ? (
          <div style={{ color: tokens.color.muted }}>Loading…</div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              gap: tokens.space(2),
            }}
          >
            {Object.entries(prices)
              .sort(([, a], [, b]) => (b as number) - (a as number))
              .map(([sym, price]) => (
                <div
                  key={sym}
                  style={{
                    border: `1px solid ${tokens.color.border}`,
                    borderRadius: tokens.radiusSm,
                    padding: `${tokens.space(3)} ${tokens.space(4)}`,
                    background: tokens.color.surfaceAlt,
                  }}
                >
                  <div
                    style={{
                      fontWeight: 500,
                      fontSize: "0.7rem",
                      color: tokens.color.muted,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                    }}
                  >
                    {sym}
                  </div>
                  <div
                    style={{
                      fontSize: "1.1rem",
                      color: tokens.color.text,
                      fontWeight: 500,
                      marginTop: tokens.space(1),
                      letterSpacing: "-0.01em",
                    }}
                  >
                    $
                    {price < 0.01
                      ? price.toExponential(2)
                      : price.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                  </div>
                </div>
              ))}
          </div>
        )}
      </Card>

      <Card title="Account balance">
        {balanceError ? (
          <div style={{ color: tokens.color.muted, fontSize: "0.9rem" }}>{balanceError}</div>
        ) : !balance ? (
          <div style={{ color: tokens.color.muted, fontSize: "0.9rem" }}>Loading…</div>
        ) : Object.values(balance).every((b) => b.available === 0 && b.pending === 0) ? (
          <div style={{ color: tokens.color.muted, fontSize: "0.9rem" }}>No funds.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${tokens.color.border}` }}>
                <th style={th}>Currency</th>
                <th style={th}>Available</th>
                <th style={th}>Pending</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(balance)
                .filter(([, b]) => b.available > 0 || b.pending > 0)
                .map(([sym, b]) => (
                  <tr key={sym} style={{ borderBottom: `1px solid ${tokens.color.border}` }}>
                    <td style={td}>
                      <strong>{sym}</strong>
                    </td>
                    <td style={td}>{b.available}</td>
                    <td style={td}>{b.pending}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: `${tokens.space(2)} ${tokens.space(2)}`,
  color: tokens.color.muted,
  fontWeight: 500,
  fontSize: "0.75rem",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
};
const td: React.CSSProperties = {
  padding: `${tokens.space(2)} ${tokens.space(2)}`,
};
