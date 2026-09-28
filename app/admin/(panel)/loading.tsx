// Shown instantly on panel navigation while the page's queries run.
export default function PanelLoading() {
  return (
    <div role="status" aria-live="polite" className="animate-pulse space-y-6">
      <span className="sr-only">Carregando…</span>
      <div className="h-9 w-48 rounded-xl bg-cocoa/10" />
      <div className="h-24 rounded-2xl bg-cocoa/5" />
      <div className="space-y-3">
        <div className="h-16 rounded-2xl bg-cocoa/5" />
        <div className="h-16 rounded-2xl bg-cocoa/5" />
        <div className="h-16 rounded-2xl bg-cocoa/5" />
      </div>
    </div>
  );
}
