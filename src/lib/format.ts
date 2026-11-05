// Formatted in UTC so server and client render identical strings.
const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const timeFmt = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
});

export const formatDate = (iso: string) => dateFmt.format(new Date(iso));

export const formatTime = (iso: string) => `${timeFmt.format(new Date(iso))} UTC`;

export const formatDateTime = (iso: string) => `${formatDate(iso)} · ${formatTime(iso)}`;
