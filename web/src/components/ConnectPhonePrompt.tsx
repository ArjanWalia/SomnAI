/**
 * Shown when the user reaches a phone-only feature on the web app. Per the
 * spec, the web app surfaces phone data but redirects phone-only actions
 * (like recording sleep) to the SomnAI iOS app.
 */
export function ConnectPhonePrompt({
  feature = 'This feature',
  detail,
}: {
  feature?: string;
  detail?: string;
}) {
  return (
    <div className="connect-phone">
      <div className="connect-phone__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="40" height="40">
          <rect
            x="6"
            y="2"
            width="12"
            height="20"
            rx="2.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <line x1="10" y1="18.5" x2="14" y2="18.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </div>
      <h3>{feature} happens on your phone</h3>
      <p>{detail ?? 'Open the SomnAI app on your iPhone to record. Your results sync here automatically.'}</p>
    </div>
  );
}
