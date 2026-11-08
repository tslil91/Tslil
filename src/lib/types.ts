export type ItemType = "ticket" | "coupon";
export type AttachmentKind = "pdf" | "photo" | "code";

export interface Attachment {
  id: string;
  kind: AttachmentKind;
  /** Original file name, shown to the user (pdf / photo). */
  name?: string;
  /** MIME type of the stored file (pdf / photo). */
  mime?: string;
  /** Where the file is stored (storage path in the cloud, IndexedDB key in demo mode). */
  path?: string;
  /** The code text (code attachments). */
  code?: string;
}

export interface Usage {
  id: string;
  amount: number;
  /** ISO timestamp */
  at: string;
  by: string;
}

export interface Item {
  id: string;
  type: ItemType;
  title: string;
  place: string;
  /** Event date (ticket) or last valid day (coupon), YYYY-MM-DD in Israel time. */
  date: string;
  /** HH:MM, tickets only. */
  time: string | null;
  /** Coupon value in ₪. Null for tickets and for non-monetary coupons (e.g. 20% off). */
  value: number | null;
  /** Balance left in ₪, null when value is null. */
  remaining: number | null;
  notes: string;
  attachments: Attachment[];
  usages: Usage[];
  usedUp: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
