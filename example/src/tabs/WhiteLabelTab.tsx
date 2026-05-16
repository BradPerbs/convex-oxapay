import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api.js";
import {
  Badge,
  Button,
  Card,
  Code,
  CopyButton,
  Field,
  Input,
  Select,
  Spinner,
  statusTone,
  tokens,
} from "../ui.js";

const PAY_OPTIONS = [
  { pay: "BTC", network: "Bitcoin", label: "Bitcoin" },
  { pay: "ETH", network: "Ethereum", label: "Ethereum" },
  { pay: "USDT", network: "Tron", label: "USDT on Tron (TRC20)" },
  { pay: "USDT", network: "Ethereum", label: "USDT on Ethereum (ERC20)" },
  { pay: "USDT", network: "BSC", label: "USDT on BSC (BEP20)" },
  { pay: "USDC", network: "Ethereum", label: "USDC on Ethereum" },
  { pay: "USDC", network: "Polygon", label: "USDC on Polygon" },
  { pay: "TRX", network: "Tron", label: "Tron" },
  { pay: "POL", network: "Polygon", label: "Polygon" },
  { pay: "LTC", network: "Litecoin", label: "Litecoin" },
  { pay: "DOGE", network: "Dogecoin", label: "Dogecoin" },
  { pay: "SOL", network: "Solana", label: "Solana" },
];

export function WhiteLabelTab({ email }: { email: string }) {
  const createWhiteLabel = useAction(api.payments.createWhiteLabel);
  const [amount, setAmount] = useState(10);
  const [currency, setCurrency] = useState("USD");
  const [pickerIndex, setPickerIndex] = useState(2); // USDT on Tron, popular default
  const [trackId, setTrackId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState<{
    address: string;
    payAmount: number;
    payCurrency: string;
    network: string;
    qrCode: string;
    memo: string;
    expiredAt: number;
  } | null>(null);

  const payment = useQuery(api.payments.getPayment, trackId ? { trackId } : "skip");

  const onCreate = async () => {
    setLoading(true);
    try {
      const opt = PAY_OPTIONS[pickerIndex];
      const result = await createWhiteLabel({
        email,
        amount,
        currency,
        payCurrency: opt.pay,
        network: opt.network,
        description: "White-label demo",
        lifetime: 60,
      });
      setTrackId(result.trackId);
      setDetails(result);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Card
        title="White-label payment"
        description="Get the raw address back and render your own checkout."
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
              {["USD", "EUR", "GBP", "BTC", "ETH"].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <div style={{ gridColumn: "1 / -1" }}>
            <Field label="Pay with">
              <Select
                value={String(pickerIndex)}
                onChange={(e) => setPickerIndex(parseInt(e.target.value))}
              >
                {PAY_OPTIONS.map((o, i) => (
                  <option key={i} value={i}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>
        <Button onClick={onCreate} loading={loading} style={{ marginTop: tokens.space(2) }}>
          Generate payment address
        </Button>
      </Card>

      {details && (
        <Card
          title={
            <span style={{ display: "flex", alignItems: "center", gap: tokens.space(2) }}>
              Send {details.payAmount} {details.payCurrency}
              <span style={{ color: tokens.color.muted, fontWeight: 400, fontSize: "0.85rem" }}>
                on {details.network}
              </span>
              {payment?.status && (
                <Badge tone={statusTone(payment.status)}>{payment.status}</Badge>
              )}
            </span>
          }
          footer={
            payment?.providerExpiredAt
              ? `Address expires at ${new Date(payment.providerExpiredAt).toLocaleString()}`
              : `Address expires at ${new Date(details.expiredAt * 1000).toLocaleString()}`
          }
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "200px 1fr",
              gap: tokens.space(5),
              alignItems: "start",
            }}
          >
            <img
              src={details.qrCode}
              alt="Payment QR code"
              style={{
                width: 200,
                height: 200,
                background: "white",
                borderRadius: tokens.radius,
                border: `1px solid ${tokens.color.border}`,
                padding: tokens.space(2),
              }}
            />
            <div style={{ display: "grid", gap: tokens.space(3) }}>
              <div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: tokens.color.muted,
                    marginBottom: tokens.space(1),
                  }}
                >
                  Deposit address
                </div>
                <div style={{ display: "flex", gap: tokens.space(2), alignItems: "center" }}>
                  <Code block>{details.address}</Code>
                  <CopyButton value={details.address} />
                </div>
              </div>
              {details.memo && (
                <div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: tokens.color.muted,
                      marginBottom: tokens.space(1),
                    }}
                  >
                    Memo / tag (required)
                  </div>
                  <div style={{ display: "flex", gap: tokens.space(2), alignItems: "center" }}>
                    <Code>{details.memo}</Code>
                    <CopyButton value={details.memo} />
                  </div>
                </div>
              )}
              <div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: tokens.color.muted,
                    marginBottom: tokens.space(1),
                  }}
                >
                  Status
                </div>
                {payment === undefined ? (
                  <Spinner />
                ) : payment ? (
                  <div style={{ display: "flex", gap: tokens.space(2), alignItems: "center" }}>
                    <Badge tone={statusTone(payment.status)}>{payment.status}</Badge>
                    {payment.txs && payment.txs.length > 0 && (
                      <span style={{ color: tokens.color.muted, fontSize: "0.85rem" }}>
                        {payment.txs.length} confirmed tx
                      </span>
                    )}
                  </div>
                ) : (
                  <span style={{ color: tokens.color.muted, fontSize: "0.85rem" }}>
                    Waiting for first webhook…
                  </span>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}
    </>
  );
}
