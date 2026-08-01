import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import GlassCard from '../components/GlassCard';
import MatchList from '../components/MatchList';
import ClaimModal from '../components/ClaimModal';

const MyClaims = () => {
  const { user } = useAuth();
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);

  // Suggested-from-matches block state.
  const [suggestions, setSuggestions] = useState([]);
  const [suggLoading, setSuggLoading] = useState(true);
  const [claimTarget, setClaimTarget] = useState(null); // found item being claimed

  const fetchSuggestions = async () => {
    setSuggLoading(true);
    try {
      const data = await api.getMatchSuggestions();
      setSuggestions(data.suggestions || []);
    } catch (err) {
      console.error('Error fetching match suggestions:', err);
    } finally {
      setSuggLoading(false);
    }
  };

  useEffect(() => {
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
    fetchClaims();
    fetchSuggestions();
  }, []);

  // A suggestion row = a scored candidate; its foundItem is the claim target.
  const handleClaimSuggestion = (match) => {
    setClaimTarget(match.foundItem);
  };

  const handleDismissSuggestion = async (match) => {
    try {
      await api.dismissMatch(match.lostItemId, match.foundItemId);
      setSuggestions((prev) => prev.filter((m) => m.pairKey !== match.pairKey));
    } catch (err) {
      console.error('Error dismissing suggestion:', err);
    }
  };

  // After a successful claim, the found item is no longer available → drop any
  // suggestions pointing at it so the block reflects reality immediately.
  const handleClaimSuccess = (foundItem) => {
    setSuggestions((prev) => prev.filter((m) => m.foundItemId !== foundItem._id));
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

      {/* ─── Suggested from Matches ───────────────────────────────────── */}
      <GlassCard style={{ padding: '24px', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-primary)' }}>
            ✨ Suggested from Matches
          </h2>
          {!suggLoading && suggestions.length > 0 && (
            <span style={{ background: 'var(--accent-gradient)', color: '#fff', fontSize: '0.72rem', fontWeight: '800', padding: '2px 10px', borderRadius: '999px' }}>
              {suggestions.length}
            </span>
          )}
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', marginBottom: '18px' }}>
          Available found items that may match your active lost reports. Claim one directly, or mark it as not relevant.
        </p>

        {suggLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0' }}>
            <div style={{ width: '28px', height: '28px', border: '3px solid var(--glass-border)', borderTop: '3px solid var(--accent-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Scoring suggestions...</span>
          </div>
        ) : (
          <MatchList
            matches={suggestions}
            onClaim={handleClaimSuggestion}
            onDismiss={handleDismissSuggestion}
            emptyText="No suggestions right now. When a found item matches one of your active lost reports, it will appear here."
          />
        )}
      </GlassCard>

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

      {/* Shared claim modal reused for suggestions (same submitClaim flow) */}
      {claimTarget && (
        <ClaimModal
          item={claimTarget}
          itemType="FoundItem"
          defaultStudentId={user?.studentId || ''}
          onClose={() => setClaimTarget(null)}
          onSuccess={handleClaimSuccess}
          submitClaim={api.submitClaim}
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
