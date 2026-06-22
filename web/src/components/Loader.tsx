export function Loader({ label }: { label?: string }) {
  return (
    <div className="row center" style={{ justifyContent: 'center', padding: 24, gap: 12 }}>
      <div className="spinner" />
      {label && <span className="muted">{label}</span>}
    </div>
  );
}
