import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { api } from "../../convex/_generated/api.js";
import {
  Badge,
  Button,
  Card,
  Code,
  CopyButton,
  Field,
  Icon,
  Input,
  Select,
  Spinner,
  statusTone,
  tokens,
} from "../ui.js";

const PRICED_IN = ["USD", "EUR", "GBP", "JPY", "INR", "AUD", "BTC", "ETH", "USDT", "USDC"];
const TO_CURRENCIES = ["(any)", "USDT", "USDC", "BTC", "ETH", "TRX"];

export function PayTab({ email }: { email: string }) {
  const createInvoice = useAction(api.payments.createInvoice);
  const [amount, setAmount] = useState(25);
  const [currency, setCurrency] = useState("USD");
  const [toCurrency, setToCurrency] = useState("(any)");
  const [description, setDescription] = useState("Premium subscription");
  const [lifetime, setLifetime] = useState(60);
  const [trackId, setTrackId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const payment = useQuery(api.payments.getPayment, trackId ? { trackId } : "skip");

  const onPay = async () => {
    setLoading(true);
    try {
      const { trackId, paymentUrl } = await createInvoice({
        email,
        amount,
        currency,
        description,
        lifetime,
        toCurrency: toCurrency === "(any)" ? undefined : toCurrency,
      });
      setTrackId(trackId);
      window.open(paymentUrl, "_blank", "noopener,noreferrer");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Card
        title="Hosted invoice"
        description="Create an invoice and redirect to pay.oxapay.com. Status updates live via webhook."
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: tokens.space(4) }}>
          <Field label="Amount">
            <Input
              type="number"
              min={1}
              step="any"
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            />
          </Field>
          <Field label="Priced in">
            <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {PRICED_IN.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Auto-convert receipts to" hint="Sweep settlements into this crypto">
            <Select value={toCurrency} onChange={(e) => setToCurrency(e.target.value)}>
              {TO_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Lifetime (minutes)" hint="15..2880, default 60">
            <Input
              type="number"
              min={15}
              max={2880}
              value={lifetime}
              onChange={(e) => setLifetime(parseInt(e.target.value) || 60)}
            />
          </Field>
          <div style={{ gridColumn: "1 / -1" }}>
            <Field label="Description">
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
          </div>
        </div>
        <div style={{ display: "flex", gap: tokens.space(2), marginTop: tokens.space(2) }}>
          <Button
            onClick={onPay}
            loading={loading}
            style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
          >
            <Icon icon={ArrowUpRight01Icon} size={14} />
            Create invoice & open
          </Button>
          <div style={{ flex: 1 }} />
          {[5, 10, 25, 50].map((amt) => (
            <Button
              key={amt}
              variant="ghost"
              onClick={() => setAmount(amt)}
              style={{ padding: "0.4rem 0.7rem" }}
            >
              ${amt}
            </Button>
          ))}
        </div>
      </Card>

      {trackId && (
        <Card
          title={
            <span style={{ display: "flex", alignItems: "center", gap: tokens.space(2) }}>
              Live status
              {payment === undefined ? <Spinner /> : null}
            </span>
          }
          description={<>Track ID: <Code>{trackId}</Code></>}
        >
          {!payment ? (
            <div style={{ color: tokens.color.muted }}>Loading payment…</div>
          ) : (
            <div style={{ display: "grid", gap: tokens.space(2), fontSize: "0.9rem" }}>
              <Row label="Status">
                <Badge tone={statusTone(payment.status)}>{payment.status}</Badge>
              </Row>
              <Row label="Amount">
                {payment.amount} {payment.currency}
              </Row>
              {payment.paidAt && (
                <Row label="Paid at">{new Date(payment.paidAt).toLocaleString()}</Row>
              )}
              {payment.paymentUrl && (
                <Row label="Hosted URL">
                  <a
                    href={payment.paymentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: tokens.color.primary, fontSize: "0.85rem" }}
                  >
                    {payment.paymentUrl}
                  </a>
                  <CopyButton value={payment.paymentUrl} />
                </Row>
              )}
              {payment.txs && payment.txs.length > 0 && (
                <Row label="Transactions">
                  <span>{payment.txs.length} confirmed tx</span>
                </Row>
              )}
            </div>
          )}
        </Card>
      )}
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "120px 1fr",
        gap: tokens.space(2),
        alignItems: "center",
      }}
    >
      <span style={{ color: tokens.color.muted, fontSize: "0.8rem" }}>{label}</span>
      <span style={{ display: "flex", alignItems: "center", gap: tokens.space(2), flexWrap: "wrap" }}>
        {children}
      </span>
    </div>
  );
}
