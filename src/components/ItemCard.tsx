import { countdown, daysUntil, formatDate, historyReason } from "../lib/dates";
import { formatILS } from "../lib/items";
import type { Item } from "../lib/types";

const ATT_LABEL = { pdf: "PDF", photo: "IMG", code: "קוד" } as const;

export function ItemCard({ item, today, onOpen }: { item: Item; today: string; onOpen: () => void }) {
  const n = daysUntil(item.date, today);
  const reason = historyReason(item, today);
  const urgent = !reason && n <= 7;
  const cd = countdown(n);

  let pill = null;
  if (reason === "used") pill = <span className="pill">נוצל במלואו</span>;
  else if (reason === "passed") pill = <span className="pill">האירוע עבר</span>;
  else if (reason === "expired") pill = <span className="pill">פג תוקף</span>;
  else if (item.value != null && item.remaining != null && item.remaining < item.value)
    pill = <span className="pill ok">נשארו {formatILS(item.remaining)} מתוך {formatILS(item.value)}</span>;
  else if (urgent) pill = <span className="pill warn">{n === 0 ? (item.type === "ticket" ? "היום!" : "יום אחרון") : n === 1 ? "מחר" : "השבוע"}</span>;

  const when = item.type === "ticket" ? `${formatDate(item.date, today)}${item.time ? ` · ${item.time}` : ""}` : `בתוקף עד ${formatDate(item.date, today)}`;
  const val = item.type === "coupon" && item.value != null && item.remaining === item.value ? ` · ${formatILS(item.value)}` : "";
  const kinds = [...new Set(item.attachments.map((a) => a.kind))];

  return (
    <button className={`stub ${item.type}${urgent ? " urgent" : ""}${reason ? " past" : ""}`} onClick={onOpen}>
      <div className="main">
        <span className="row1">
          <span className="kind">{item.type === "ticket" ? "כרטיס" : "שובר"}</span>
          <span className="atts">{kinds.map((k) => <span className="att" key={k}>{ATT_LABEL[k]}</span>)}</span>
        </span>
        <span className="name">{item.title}</span>
        <span className="meta">{when}{(item.place || val) && <><br />{item.place}{val}</>}</span>
        {pill}
        {!reason && item.value != null && item.remaining != null && item.value > 0 && (
          <span className="bar"><i style={{ width: `${Math.round((item.remaining / item.value) * 100)}%` }} /></span>
        )}
      </div>
      <div className="side">
        {reason === "used" ? <><b>✓</b><small>נוצל</small></> : reason ? <><b>–</b><small>{reason === "passed" ? "עבר" : "פג"}</small></> : <><b>{cd.num}</b><small>{cd.label}</small></>}
      </div>
    </button>
  );
}
