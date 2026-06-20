export function Loader({ label }: { label?: string }) {
  return (
    <div className="loader" role="status" aria-live="polite">
      <span className="loader__spinner" />
      {label && <span className="loader__label">{label}</span>}
    </div>
  );
}
