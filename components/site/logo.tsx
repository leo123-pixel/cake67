// The prototype logo PNGs are masks tinted with currentColor.
function maskStyle(src: string): React.CSSProperties {
  const mask = `url(${src}) center / contain no-repeat`;
  return { WebkitMask: mask, mask, backgroundColor: "currentColor" };
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className="inline-block size-9" style={maskStyle("/brand/logo-mark.png")} />
      <span
        className="inline-block h-5 aspect-[912/186]"
        style={maskStyle("/brand/logo-word.png")}
      />
    </span>
  );
}
