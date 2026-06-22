/** Shown where a feature is phone-only (e.g. recording sleep). */
export function ConnectPhonePrompt({ message }: { message?: string }) {
  return (
    <div className="card center stack" style={{ alignItems: 'center', gap: 10 }}>
      <div style={{ fontSize: 40 }}>📱</div>
      <strong>This happens on your phone</strong>
      <p className="muted" style={{ margin: 0 }}>
        {message ??
          'Sleep is recorded by the SomnAI iPhone app overnight. Open it on your phone to start a recording — your nights will appear here automatically.'}
      </p>
    </div>
  );
}
