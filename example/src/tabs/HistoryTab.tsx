import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api.js";
import { Badge, Card, Code, Field, Select, statusTone, tokens } from "../ui.js";

const TYPE_OPTIONS = ["all", "invoice", "white_label", "static_address", "payment_link", "donation"];
const STATUS_OPTIONS = [
  "all",
  "new",
  "waiting",
  "paying",
  "paid",
  "manual_accept",
  "underpaid",
  "refunding",
  "refunded",
  "expired",
];

export function HistoryTab({ email }: { email: string }) {
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const payments = useQuery(api.payments.listMine, {
    email,
    type: type === "all" ? undefined : type,
    status: status === "all" ? undefined : status,
    limit: 100,
  });

  return (
    <>
      <Card title="Filter">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: tokens.space(4) }}>
          <Field label="Type">
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              {TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      <Card title={`Results (${payments?.length ?? 0})`}>
        {!payments ? (
          <div style={{ color: tokens.color.muted }}>Loading…</div>
        ) : payments.length === 0 ? (
          <div style={{ color: tokens.color.muted, fontSize: "0.9rem" }}>No payments.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${tokens.color.border}` }}>
                <th style={th}>When</th>
                <th style={th}>Type</th>
                <th style={th}>Track ID</th>
                <th style={th}>Amount</th>
                <th style={th}>Pay</th>
                <th style={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p: any) => (
                <tr key={p._id} style={{ borderBottom: `1px solid ${tokens.color.border}` }}>
                  <td style={td}>{new Date(p._creationTime).toLocaleString()}</td>
                  <td style={td}>
                    <Badge tone="info">{p.type}</Badge>
                  </td>
                  <td style={td}>
                    <Code>{p.id.slice(0, 12)}…</Code>
                  </td>
                  <td style={td}>
                    {p.amount} {p.currency}
                  </td>
                  <td style={td}>
                    {p.payAmount != null
                      ? `${p.payAmount} ${p.payCurrency ?? ""}`
                      : ""}
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
