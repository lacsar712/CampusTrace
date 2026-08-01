import { formatReason } from '../utils/matchAssist';

// Presentational-only list of possible found-item matches.
// Scoring / thresholds are NOT computed here — callers pass already-scored
// candidates produced via utils/matchAssist.js (directly or through the API).
//
// Optional callbacks:
//   onDismiss(match) - renders a "Not relevant" button per row
//   onClaim(match)   - renders a "Claim This Item" button per row (reuses the
//                      shared claim flow supplied by the caller)
const MatchList = ({ matches = [], emptyText = 'No possible matches found yet.', onDismiss, onClaim }) => {
  if (!matches.length) {
    return (
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', textAlign: 'center', padding: '16px 0' }}>
        {emptyText}
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {matches.map((m) => {
        const found = m.foundItem || {};
        const date = found.dateFound
          ? new Date(found.dateFound).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
          : '—';

        return (
          <div
            key={m.pairKey}
            style={{
              display: 'flex',
              gap: '14px',
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--glass-border)',
              alignItems: 'center',
            }}
          >
            {/* Thumbnail */}
            {found.image?.url ? (
              <img
                src={found.image.url}
                alt={found.itemName}
                style={{ width: '52px', height: '52px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }}
              />
            ) : (
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '10px',
                  background: 'var(--bg-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.3rem',
                  flexShrink: 0,
                }}
              >
                📦
              </div>
            )}

            {/* Details */}
            <div style={{ flexGrow: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <h4
                  style={{
                    fontSize: '0.95rem',
                    fontWeight: '700',
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {found.itemName || 'Found item'}
                </h4>
                <span
                  style={{
                    flexShrink: 0,
                    background: 'var(--accent-gradient)',
                    color: '#ffffff',
                    fontSize: '0.75rem',
                    fontWeight: '800',
                    padding: '3px 10px',
                    borderRadius: '999px',
                  }}
                >
                  {m.score} pts
                </span>
              </div>

              <div style={{ display: 'flex', gap: '14px', fontSize: '0.76rem', color: 'var(--text-tertiary)', marginTop: '3px' }}>
                <span>📍 {found.foundLocation || '—'}</span>
                <span>📅 {date}</span>
              </div>

              {/* Reasons */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                {(m.reasons || []).map((r) => (
                  <span
                    key={r}
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: '700',
                      color: 'var(--accent-primary)',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--glass-border)',
                      padding: '2px 8px',
                      borderRadius: '6px',
                    }}
                  >
                    {formatReason(r)}
                  </span>
                ))}
              </div>

              {/* Optional per-row actions */}
              {(onClaim || onDismiss) && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  {onClaim && (
                    <button
                      className="btn btn-primary"
                      style={{ padding: '6px 14px', fontSize: '0.78rem' }}
                      onClick={() => onClaim(m)}
                    >
                      Claim This Item
                    </button>
                  )}
                  {onDismiss && (
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '6px 14px', fontSize: '0.78rem' }}
                      onClick={() => onDismiss(m)}
                    >
                      Not relevant
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MatchList;
