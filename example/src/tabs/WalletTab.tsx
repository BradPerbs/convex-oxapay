import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { QrCodeIcon, Wallet02Icon } from "@hugeicons/core-free-icons";
import { api } from "../../convex/_generated/api.js";
import {
  Badge,
  Button,
  Card,
  Code,
  CopyButton,
  Field,
  Icon,
  Select,
  statusTone,
  tokens,
} from "../ui.js";

const NETWORK_PRESETS = [
  { network: "Tron", toCurrency: "USDT", label: "USDT (TRC20)" },
  { network: "Ethereum", toCurrency: "USDT", label: "USDT (ERC20)" },
  { network: "BSC", toCurrency: "USDT", label: "USDT (BEP20)" },
  { network: "Ethereum", toCurrency: "USDC", label: "USDC (ERC20)" },
  { network: "Bitcoin", toCurrency: undefined, label: "Bitcoin" },
  { network: "Ethereum", toCurrency: undefined, label: "Ethereum" },
  { network: "Tron", toCurrency: undefined, label: "Tron" },
  { network: "Solana", toCurrency: undefined, label: "Solana" },
  { network: "Polygon", toCurrency: undefined, label: "Polygon" },
];

export function WalletTab({ email }: { email: string }) {
  const create = useAction(api.staticAddresses.create);
  const wallets = useQuery(api.staticAddresses.listMine, { email });
  const [presetIndex, setPresetIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  const onCreate = async () => {
    setLoading(true);
    try {
      const preset = NETWORK_PRESETS[presetIndex];
      await create({
        email,
        network: preset.network,
        toCurrency: preset.toCurrency,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Card
        title="Static deposit address"
        description="Permanent address. Auto-revoked after 6 months of inactivity."
      >
        <div style={{ display: "flex", gap: tokens.space(3), alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <Field label="Network / Currency">
              <Select
                value={String(presetIndex)}
                onChange={(e) => setPresetIndex(parseInt(e.target.value))}
              >
                {NETWORK_PRESETS.map((p, i) => (
                  <option key={i} value={i}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Button
            onClick={onCreate}
            loading={loading}
            style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
          >
            <Icon icon={Wallet02Icon} size={14} />
            Generate wallet
          </Button>
        </div>
      </Card>

      <Card title={`Your wallets (${wallets?.length ?? 0})`}>
        {!wallets || wallets.length === 0 ? (
          <div style={{ color: tokens.color.muted, fontSize: "0.9rem" }}>
            No wallets yet. Use the form above to generate one.
          </div>
        ) : (
          <div style={{ display: "grid", gap: tokens.space(3) }}>
            {wallets.map((w: any) => {
              const totalReceived =
                w.txs?.reduce(
                  (sum: number, t: any) => sum + (typeof t.amount === "number" ? t.amount : 0),
                  0,
                ) ?? 0;
              return (
                <div
                  key={w._id}
                  style={{
                    border: `1px solid ${tokens.color.border}`,
                    borderRadius: tokens.radiusSm,
                    padding: tokens.space(4),
                    background: tokens.color.surfaceAlt,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: tokens.space(2),
                    }}
                  >
                    <span style={{ display: "flex", gap: tokens.space(2), alignItems: "center" }}>
                      <strong style={{ fontSize: "0.95rem" }}>{w.network}</strong>
                      {w.toCurrency && (
                        <Badge tone="info">→ {w.toCurrency}</Badge>
                      )}
                      <Badge tone={statusTone(w.status)}>{w.status}</Badge>
                    </span>
                    <span style={{ fontSize: "0.85rem", color: tokens.color.muted }}>
                      Created {new Date(w._creationTime).toLocaleDateString()}
                    </span>
                  </div>
                  {w.address && (
                    <div
                      style={{
                        display: "flex",
                        gap: tokens.space(2),
                        alignItems: "center",
                        marginBottom: tokens.space(2),
                      }}
                    >
                      <Code block>{w.address}</Code>
                      <CopyButton value={w.address} />
                      {w.qrCode && (
                        <a
                          href={w.qrCode}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.25rem",
                            fontSize: "0.75rem",
                            color: tokens.color.primary,
                            textDecoration: "none",
                          }}
                        >
                          <Icon icon={QrCodeIcon} size={14} />
                          QR
                        </a>
                      )}
                    </div>
                  )}
                  {w.txs && w.txs.length > 0 ? (
                    <div style={{ fontSize: "0.85rem", color: tokens.color.muted }}>
                      {w.txs.length} deposit{w.txs.length === 1 ? "" : "s"} · total{" "}
                      <strong style={{ color: tokens.color.text }}>
                        {totalReceived || 0} {w.txs[0].currency ?? ""}
                      </strong>
                    </div>
                  ) : (
                    <div style={{ fontSize: "0.85rem", color: tokens.color.muted }}>
                      No deposits yet. Send crypto to the address above.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}
