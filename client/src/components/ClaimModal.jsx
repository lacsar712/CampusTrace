import { useState, useEffect } from 'react';
import { api } from '../services/api';
import GlassCard from './GlassCard';

// Shared ownership-claim modal (single implementation of the claim flow).
// Used by Dashboard feed cards and MyClaims match suggestions.
const ClaimModal = ({ item, itemType, defaultStudentId = '', onClose, onSuccess }) => {
  const [claimForm, setClaimForm] = useState({
    claimReason: '',
    proofDetails: '',
    studentIdProvided: defaultStudentId,
  });
  const [claimErrors, setClaimErrors] = useState({});
  const [claimTouched, setClaimTouched] = useState({});
  const [claimSuccess, setClaimSuccess] = useState(false);
  const [claimSubmitError, setClaimSubmitError] = useState(null);
  const [claiming, setClaiming] = useState(false);

  // High-score conflict hint (other users' active lost items, score >= 80)
  const [conflicts, setConflicts] = useState([]);

  useEffect(() => {
    const fetchConflicts = async () => {
      if (itemType !== 'FoundItem' || item.status !== 'available') return;
      try {
        const data = await api.getMatchConflicts(item._id);
        setConflicts(data.conflicts || []);
      } catch (err) {
        console.error('Error fetching match conflicts:', err);
      }
    };
    fetchConflicts();
  }, [item._id, item.status, itemType]);

  const topConflict = conflicts[0] || null;

  const validateClaim = (form) => {
    const errors = {};
    if (!form.claimReason) {
      errors.claimReason = 'Claim reason is required';
    } else if (form.claimReason.trim().length < 10) {
      errors.claimReason = 'Claim reason/proof must be at least 10 characters';
    }
    return errors;
  };

  const handleClaimInputChange = (e) => {
    const { name, value } = e.target;
    const updatedForm = { ...claimForm, [name]: value };
    setClaimForm(updatedForm);
    if (claimTouched[name]) {
      setClaimErrors(validateClaim(updatedForm));
    }
  };

  const handleClaimBlur = (e) => {
    const { name } = e.target;
    setClaimTouched((prev) => ({ ...prev, [name]: true }));
    setClaimErrors(validateClaim(claimForm));
  };

  const handleClaimSubmit = async (e) => {
    e.preventDefault();
    setClaimTouched({ claimReason: true, proofDetails: true, studentIdProvided: true });

    const errors = validateClaim(claimForm);
    setClaimErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setClaiming(true);
    setClaimSubmitError(null);

    try {
      await api.submitClaim({
        itemId: item._id,
        itemType,
        claimReason: claimForm.claimReason,
        proofDetails: claimForm.proofDetails,
        studentIdProvided: claimForm.studentIdProvided,
      });
      setClaimSuccess(true);
      if (onSuccess) onSuccess(item);

      // Automatically close modal after success
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setClaimSubmitError(err.message || 'Submission failed');
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
      onClick={onClose}
    >
      <GlassCard
        style={{
          width: '100%',
          maxWidth: '540px',
          padding: '32px',
          position: 'relative',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
          background: 'var(--glass-modal-bg)',
        }}
        onClick={(e) => e.stopPropagation()} // Prevent close on card click
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: '1.2rem',
            cursor: 'pointer',
            transition: 'var(--transition-fast)',
          }}
          onMouseOver={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
          onMouseOut={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
        >
          ✕
        </button>

        {claimSuccess ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <span style={{ fontSize: '3.5rem', display: 'block', marginBottom: '16px', animation: 'scaleUp 0.3s ease-out' }}>🎉</span>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--color-success)', marginBottom: '8px' }}>
              Claim Submitted Successfully!
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
              Your claim has been recorded. Administrators will verify the proof and contact you. Redirecting...
            </p>
          </div>
        ) : (
          <form onSubmit={handleClaimSubmit}>
            <h3 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '6px', color: 'var(--text-primary)' }}>
              Submit Ownership Claim
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '24px' }}>
              Item: <strong style={{ color: 'var(--text-primary)' }}>{item.itemName}</strong> ({item.category})
            </p>

            {/* High-score conflict hint (non-blocking) */}
            {topConflict && (
              <div
                style={{
                  background: 'var(--color-danger-bg)',
                  border: '1px solid var(--color-danger)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 16px',
                  marginBottom: '18px',
                  fontSize: '0.85rem',
                  lineHeight: '1.5',
                }}
              >
                <p style={{ fontWeight: '800', color: 'var(--color-danger)', marginBottom: '4px' }}>
                  ⚠️ Possible Ownership Conflict
                </p>
                <p style={{ color: 'var(--text-primary)' }}>
                  Active lost report <strong>"{topConflict.lostItem.itemName}"</strong> matches this item with a high score of{' '}
                  <strong>{topConflict.score} pts</strong>.
                </p>
                <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
                  可能已有相关度更高的失主报告，请管理员留意。
                </p>
              </div>
            )}

            {claimSubmitError && (
              <div style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)', border: '1px solid var(--color-danger)', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', fontWeight: '600', marginBottom: '18px' }}>
                ⚠️ {claimSubmitError}
              </div>
            )}

            <div className="input-group">
              <label className="input-label">Reason for Claim (Proof of Ownership) *</label>
              <textarea
                name="claimReason"
                value={claimForm.claimReason}
                onChange={handleClaimInputChange}
                onBlur={handleClaimBlur}
                rows="3"
                className={`input-field ${claimTouched.claimReason && claimErrors.claimReason ? 'error' : claimTouched.claimReason && !claimErrors.claimReason ? 'success' : ''}`}
                placeholder="Describe exactly when and where you lost it, brand name, distinctive marks, lockscreen passwords, contents etc."
                style={{ resize: 'none', height: '90px' }}
                required
              />
              {claimTouched.claimReason && claimErrors.claimReason && (
                <span className="validation-msg error">{claimErrors.claimReason}</span>
              )}
            </div>

            <div className="input-group">
              <label className="input-label">Additional Serial Number / Proof Details (Optional)</label>
              <input
                type="text"
                name="proofDetails"
                value={claimForm.proofDetails}
                onChange={handleClaimInputChange}
                className="input-field"
                placeholder="e.g. Serial: WH-10023, keys labeled 'Hostel A'"
              />
            </div>

            <div className="input-group" style={{ marginBottom: '28px' }}>
              <label className="input-label">Verified Student ID *</label>
              <input
                type="text"
                name="studentIdProvided"
                value={claimForm.studentIdProvided}
                onChange={handleClaimInputChange}
                className="input-field"
                placeholder="Confirm your Student ID card number"
                required
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose} style={{ padding: '10px 18px' }}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ padding: '10px 24px' }}
                disabled={claiming || !claimForm.claimReason || Object.keys(claimErrors).length > 0}
              >
                {claiming ? 'Submitting...' : 'Submit Claim'}
              </button>
            </div>
          </form>
        )}
      </GlassCard>
    </div>
  );
};

export default ClaimModal;
