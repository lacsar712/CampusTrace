import { useState, useEffect } from 'react';
import GlassCard from './GlassCard';
import { api } from '../services/api';

// Shared ownership-claim modal. Wraps the existing submitClaim flow so both the
// Dashboard feed and the MyClaims suggestions block reuse ONE claim form/endpoint.
//
// When claiming a FoundItem, it also surfaces a non-blocking "other user's
// high-score conflict" hint (score >= 80, judged server-side via
// computeMatchScore + meetsConflictThreshold — never inlined here).
//
// Props:
//   item            - the item being claimed (needs _id, itemName, category)
//   itemType        - 'LostItem' | 'FoundItem' (passed straight to submitClaim)
//   defaultStudentId- prefill for the verified student id field
//   onClose()       - close the modal
//   onSuccess(item) - called after a successful claim submission
//   submitClaim(payload) - the api.submitClaim function (injected to keep this
//                          component free of direct service imports)
const ClaimModal = ({ item, itemType, defaultStudentId = '', onClose, onSuccess, submitClaim }) => {
  const [form, setForm] = useState({ claimReason: '', proofDetails: '', studentIdProvided: defaultStudentId });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [conflict, setConflict] = useState(null);

  // Fetch a potential other-user high-score conflict for found items only.
  useEffect(() => {
    if (itemType !== 'FoundItem' || !item?._id) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await api.getClaimConflict(item._id);
        if (!cancelled) setConflict(data.conflict || null);
      } catch (err) {
        console.error('Error checking claim conflict:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [itemType, item?._id]);

  const validate = (f) => {
    const e = {};
    if (!f.claimReason) {
      e.claimReason = 'Claim reason is required';
    } else if (f.claimReason.trim().length < 10) {
      e.claimReason = 'Claim reason/proof must be at least 10 characters';
    }
    return e;
  };

  const handleChange = (evt) => {
    const { name, value } = evt.target;
    const updated = { ...form, [name]: value };
    setForm(updated);
    if (touched[name]) setErrors(validate(updated));
  };

  const handleBlur = (evt) => {
    const { name } = evt.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    setErrors(validate(form));
  };

  const handleSubmit = async (evt) => {
    evt.preventDefault();
    setTouched({ claimReason: true, proofDetails: true, studentIdProvided: true });
    const e = validate(form);
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setClaiming(true);
    setSubmitError(null);
    try {
      await submitClaim({
        itemId: item._id,
        itemType,
        claimReason: form.claimReason,
        proofDetails: form.proofDetails,
        studentIdProvided: form.studentIdProvided,
      });
      setSuccess(true);
      if (onSuccess) onSuccess(item);
      setTimeout(() => {
        if (onClose) onClose();
      }, 2000);
    } catch (err) {
      setSubmitError(err.message || 'Submission failed');
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
        onClick={(e) => e.stopPropagation()}
      >
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

        {success ? (
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
          <form onSubmit={handleSubmit}>
            <h3 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '6px', color: 'var(--text-primary)' }}>
              Submit Ownership Claim
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '24px' }}>
              Item: <strong style={{ color: 'var(--text-primary)' }}>{item.itemName}</strong> ({item.category})
            </p>

            {/* Non-blocking other-user high-score conflict hint (score >= 80) */}
            {conflict && (
              <div
                style={{
                  background: 'var(--color-warning-bg, rgba(245, 158, 11, 0.12))',
                  color: 'var(--color-warning, #b45309)',
                  border: '1px solid var(--color-warning, #f59e0b)',
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  marginBottom: '18px',
                  lineHeight: '1.5',
                }}
              >
                ⚠️ Potential conflict: this found item strongly matches another user's lost report{' '}
                <strong>“{conflict.lostItemName}”</strong> with a match score of{' '}
                <strong>{conflict.score}</strong>. 可能已有相关度更高的失主报告，请管理员留意。
              </div>
            )}

            {submitError && (
              <div style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)', border: '1px solid var(--color-danger)', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', fontWeight: '600', marginBottom: '18px' }}>
                ⚠️ {submitError}
              </div>
            )}

            <div className="input-group">
              <label className="input-label">Reason for Claim (Proof of Ownership) *</label>
              <textarea
                name="claimReason"
                value={form.claimReason}
                onChange={handleChange}
                onBlur={handleBlur}
                rows="3"
                className={`input-field ${touched.claimReason && errors.claimReason ? 'error' : touched.claimReason && !errors.claimReason ? 'success' : ''}`}
                placeholder="Describe exactly when and where you lost it, brand name, distinctive marks, lockscreen passwords, contents etc."
                style={{ resize: 'none', height: '90px' }}
                required
              />
              {touched.claimReason && errors.claimReason && (
                <span className="validation-msg error">{errors.claimReason}</span>
              )}
            </div>

            <div className="input-group">
              <label className="input-label">Additional Serial Number / Proof Details (Optional)</label>
              <input
                type="text"
                name="proofDetails"
                value={form.proofDetails}
                onChange={handleChange}
                className="input-field"
                placeholder="e.g. Serial: WH-10023, keys labeled 'Hostel A'"
              />
            </div>

            <div className="input-group" style={{ marginBottom: '28px' }}>
              <label className="input-label">Verified Student ID *</label>
              <input
                type="text"
                name="studentIdProvided"
                value={form.studentIdProvided}
                onChange={handleChange}
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
                disabled={claiming || !form.claimReason || Object.keys(errors).length > 0}
              >
                {claiming ? 'Submitting...' : 'Submit Claim'}
              </button>
            </div>
          </form>
        )}
      </GlassCard>

      <style>
        {`
          @keyframes scaleUp {
            0% { transform: scale(0.8); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
          }
        `}
      </style>
    </div>
  );
};

export default ClaimModal;
