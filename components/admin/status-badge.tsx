const TONES = {
  green: "bg-olive/15 text-olive-dark",
  gray: "bg-cocoa/10 text-cocoa-soft",
  amber: "bg-peach text-cocoa",
  red: "bg-raspberry/15 text-raspberry",
} as const;

export function StatusBadge({ tone, children }: { tone: keyof typeof TONES; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}>
      {children}
    </span>
  );
}
