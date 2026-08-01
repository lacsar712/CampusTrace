import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatReason } from '../utils/matchAssist';
import GlassCard from '../components/GlassCard';
import ClaimModal from '../components/ClaimModal';

const MyClaims = () => {
  const { user } = useAuth();
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);

  // Suggested from Matches states
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [claimTarget, setClaimTarget] = useState(null); // suggestion being claimed

  const fetchClaims = async () => {
    try {
      const data = await api.getMyClaims();
      setClaims(data);
    } catch (err) {
      console.error('Error fetching user claims:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuggestions = async () => {
    try {
      const data = await api.getMatchSuggestions();
      setSuggestions(data.suggestions || []);
    } catch (err) {
      console.error('Error fetching match suggestions:', err);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  useEffect(() => {
    fetchClaims();
    fetchSuggestions();
  }, []);

  // Mark a suggested pair as not relevant (per-user, persisted)
  const handleDismissSuggestion = async (suggestion) => {
    try {
      await api.dismissMatch(suggestion.pairKey);
      setSuggestions((prev) => prev.filter((s) => s.pairKey !== suggestion.pairKey));
    } catch (err) {
      console.error('Error dismissing suggestion:', err);
    }
  };

  // After a successful claim, drop the suggestion and refresh the claims list
  const handleSuggestionClaimSuccess = () => {
    if (claimTarget) {
      setSuggestions((prev) => prev.filter((s) => s.pairKey !== claimTarget.pairKey));
    }
    fetchClaims();
  };

  const getStatusEmoji = (status) => {
    if (status === 'approved') return '✅';
    if (status === 'rejected') return '❌';
    return '⏳';
  };

  return (
    <div className="container" style={{ paddingBottom: '60px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '8px' }}>
          My Claim Requests 📋
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Track the status of ownership requests submitted for found or lost items.
        </p>
      </div>

      {/* ─── SUGGESTED FROM MATCHES SECTION ──────────────────────────── */}
      <div style={{ marginBottom: '40px' }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '6px' }}>
          ✨ Suggested from Matches
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '16px' }}>
          Found items that may belong to you, based on your active lost reports.
        </p>

        {suggestionsLoading ? (
          <GlassCard style={{ padding: '24px', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Scoring possible matches...</p>
          </GlassCard>
        ) : suggestions.length === 0 ? (
          <GlassCard style={{ padding: '24px', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              No suggestions right now. Publish a lost report and we will surface matching found items here.
            </p>
          </GlassCard>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {suggestions.map((suggestion) => (
              <GlassCard key={suggestion.pairKey} style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
                  <div style={{ flexGrow: 1, minWidth: '240px' }}>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '6px' }}>
                      For your lost report: {suggestion.lostItem.itemName}
                    </p>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>
                      {suggestion.foundItem.itemName}
                    </h3>
                    <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                      📍 {suggestion.foundItem.foundLocation} &nbsp;·&nbsp; 📅 {new Date(suggestion.foundItem.dateFound).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {suggestion.reasons.map((reason) => (
                        <span
                          key={reason}
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: '700',
                            padding: '4px 10px',
                            borderRadius: '999px',
                            background: 'var(--glass-bg)',
                            border: '1px solid var(--glass-border)',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {formatReason(reason)}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px', flexShrink: 0 }}>
                    <span
                      style={{
                        background: 'var(--accent-gradient)',
                        color: '#ffffff',
                        fontWeight: '800',
                        fontSize: '0.85rem',
                        padding: '6px 12px',
                        borderRadius: '999px',
                      }}
                    >
                      {suggestion.score} pts
                    </span>
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ padding: '8px 18px', fontSize: '0.85rem' }}
                      onClick={() => setClaimTarget(suggestion)}
                    >
                      Claim This Item
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDismissSuggestion(suggestion)}
                      style={{
                        background: 'transparent',
                        border: '1px solid var(--glass-border)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-tertiary)',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        padding: '5px 12px',
                        cursor: 'pointer',
                        transition: 'var(--transition-fast)',
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.color = 'var(--color-danger)';
                        e.currentTarget.style.borderColor = 'var(--color-danger)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.color = 'var(--text-tertiary)';
                        e.currentTarget.style.borderColor = 'var(--glass-border)';
                      }}
                    >
                      🚫 Not relevant
                    </button>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '16px' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid var(--glass-border)', borderTop: '3px solid var(--accent-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <p style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Fetching your claim requests...</p>
        </div>
      ) : claims.length === 0 ? (
        <GlassCard style={{ padding: '48px', textAlign: 'center' }}>
          <span style={{ fontSize: '3rem', display: 'block', marginBottom: '16px' }}>📄</span>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>
            No claims submitted yet
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '400px', margin: '0 auto' }}>
            When you find an item in the dashboard reported by others and click 'Claim This Item', your claim requests will be listed here.
          </p>
        </GlassCard>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {claims.map((claim) => (
            <GlassCard key={claim._id} style={{ padding: '24px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: '16px',
                  borderBottom: '1px solid var(--glass-border)',
                  paddingBottom: '16px',
                  marginBottom: '16px',
                }}
              >
                {/* Item Details */}
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  {claim.itemId?.image?.url ? (
                    <img
                      src={claim.itemId.image.url}
                      alt={claim.itemId.itemName}
                      style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '12px',
                        objectFit: 'cover',
                        border: '1px solid var(--glass-border)',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '12px',
                        background: 'var(--bg-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.5rem',
                      }}
                    >
                      📦
                    </div>
                  )}
                  <div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>
                      {claim.itemId?.itemName || 'Unknown Item'}
                    </h3>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', fontWeight: '600', textTransform: 'uppercase' }}>
                      {claim.itemId?.category || 'Category'} • Claimed as {claim.itemType === 'LostItem' ? 'Lost' : 'Found'}
                    </span>
                  </div>
                </div>

                {/* Status Badges */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                  <span className={`badge badge-${claim.status}`} style={{ fontSize: '0.85rem', padding: '6px 12px' }}>
                    {getStatusEmoji(claim.status)} {claim.status}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                    Submitted on {new Date(claim.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Claim Description & Proof details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', flexWrap: 'wrap' }}>
                <div>
                  <h4 style={{ fontSize: '0.82rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Proof of Ownership Provided
                  </h4>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: '1.5', background: 'rgba(255, 255, 255, 0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                    {claim.claimReason}
                  </p>
                  
                  {claim.proofDetails && (
                    <div style={{ marginTop: '12px' }}>
                      <h4 style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        Serial Number / Key Marks
                      </h4>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', fontWeight: '600' }}>
                        {claim.proofDetails}
                      </span>
                    </div>
                  )}
                </div>

                {/* Admin Feedback Box */}
                <div>
                  <h4 style={{ fontSize: '0.82rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Administrator Feedback
                  </h4>
                  {claim.status === 'pending' ? (
                    <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px dashed var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100px' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', fontStyle: 'italic', textAlign: 'center' }}>
                        Your claim is currently under review by campus admins. You will receive feedback here once approved or rejected.
                      </span>
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: '16px',
                        background: claim.status === 'approved' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                        borderRadius: '8px',
                        border: `1px solid ${claim.status === 'approved' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                        minHeight: '100px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <p style={{ fontSize: '0.88rem', color: claim.status === 'approved' ? 'var(--text-primary)' : 'var(--text-primary)', lineHeight: '1.5', fontStyle: 'italic' }}>
                        "{claim.adminResponse || 'No response provided by admin.'}"
                      </p>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '12px', alignSelf: 'flex-end', fontWeight: '500' }}>
                        Reviewed on {new Date(claim.reviewedAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Claim modal reuses the shared claim flow (submitClaim API) */}
      {claimTarget && (
        <ClaimModal
          item={claimTarget.foundItem}
          itemType="FoundItem"
          defaultStudentId={user?.studentId || ''}
          onClose={() => setClaimTarget(null)}
          onSuccess={handleSuggestionClaimSuccess}
        />
      )}

      <style>
        {`
          @keyframes spin {
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default MyClaims;
