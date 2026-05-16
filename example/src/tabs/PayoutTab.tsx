import { useState } from "react";
import { useQuery } from "convex/react";
import { ArrowUp01Icon } from "@hugeicons/core-free-icons";
import { api } from "../../convex/_generated/api.js";
import {
  Badge,
  Button,
  Card,
  Code,
  Field,
  Icon,
  Input,
  Select,
  statusTone,
  tokens,
} from "../ui.js";

const PAYOUT_OPTIONS = [
  { currency: "USDT", network: "Tron", label: "USDT on Tron (TRC20)" },
  { currency: "USDT", network: "Ethereum", label: "USDT on Ethereum (ERC20)" },
  { currency: "USDT", network: "BSC", label: "USDT on BSC (BEP20)" },
  { currency: "USDC", network: "Ethereum", label: "USDC on Ethereum" },
  { currency: "BTC", network: "Bitcoin", label: "Bitcoin" },
  { currency: "ETH", network: "Ethereum", label: "Ethereum" },
  { currency: "TRX", network: "Tron", label: "Tron" },
  { currency: "POL", network: "Polygon", label: "POL on Polygon" },
];

export function PayoutTab({ email }: { email: string }) {
  const payouts = useQuery(api.payouts.listMine, { email, limit: 20 });
  const [pickerIndex, setPickerIndex] = useState(0);
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState(1);

  return (
    <>
      <Card
        title={
          <span style={{ display: "flex", alignItems: "center", gap: tokens.space(2) }}>
            Payout <Badge tone="warning">DISABLED</Badge>
          </span>
        }
        description="OxaPay has no payout sandbox. Disabled in this demo."
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: tokens.space(4), opacity: 0.85 }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <Field label="Currency / Network">
              <Select
                value={String(pickerIndex)}
                onChange={(e) => setPickerIndex(parseInt(e.target.value))}
              >
                {PAYOUT_OPTIONS.map((o, i) => (
                  <option key={i} value={i}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <Field label="Destination address">
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="T..."
              />
            </Field>
          </div>
          <Field label="Amount">
            <Input
              type="number"
              min={0}
              step="any"
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            />
          </Field>
        </div>
        <div style={{ marginTop: tokens.space(3) }}>
          <Button
            variant="danger"
            disabled
            style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
          >
            <Icon icon={ArrowUp01Icon} size={14} />
            Submit payout
          </Button>
        </div>
      </Card>

      <Card title={`Your payouts (${payouts?.length ?? 0})`}>
        {!payouts || payouts.length === 0 ? (
          <div style={{ color: tokens.color.muted, fontSize: "0.9rem" }}>No payouts.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${tokens.color.border}` }}>
                <th style={th}>Track ID</th>
                <th style={th}>Amount</th>
                <th style={th}>To</th>
                <th style={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((p: any) => (
                <tr key={p._id} style={{ borderBottom: `1px solid ${tokens.color.border}` }}>
                  <td style={td}>
                    <Code>{p.id.slice(0, 14)}…</Code>
                  </td>
                  <td style={td}>
                    {p.amount} {p.currency}
                  </td>
                  <td style={td}>
                    <Code>{p.address.slice(0, 16)}…</Code>
                  </td>
                  <td style={td}>
                    <Badge tone={statusTone(p.status)}>{p.status}</Badge>
                  </td>
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
