import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import GlassCard from './GlassCard';

const validateClaim = (form) => {
  const errors = {};
  if (!form.claimReason) {
    errors.claimReason = 'Claim reason is required';
  } else if (form.claimReason.trim().length < 10) {
    errors.claimReason = 'Claim reason/proof must be at least 10 characters';
  }
  return errors;
};

const ClaimModal = ({ item, itemType, onClose, onClaimed }) => {
  const { user } = useAuth();
  const [form, setForm] = useState({
    claimReason: '',
    proofDetails: '',
    studentIdProvided: user?.studentId || '',
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [conflicts, setConflicts] = useState([]);
  const [conflictsLoading, setConflictsLoading] = useState(false);

  useEffect(() => {
    setForm({
      claimReason: '',
      proofDetails: '',
      studentIdProvided: user?.studentId || '',
    });
    setErrors({});
    setTouched({});
    setSuccess(false);
    setSubmitError(null);
    setSubmitting(false);
    setConflicts([]);
    setConflictsLoading(false);

    // Only FoundItem claims can conflict with other users' active lost reports.
    if (item && itemType === 'FoundItem' && item._id) {
      setConflictsLoading(true);
      api
        .getFoundClaimConflicts(item._id)
        .then((data) => setConflicts(data.conflicts || []))
        .catch((err) => {
          console.error('Error fetching claim conflicts:', err);
          setConflicts([]);
        })
        .finally(() => setConflictsLoading(false));
    }
  }, [item?._id, itemType, user?.studentId]);

  if (!item) return null;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const updated = { ...form, [name]: value };
    setForm(updated);
    if (touched[name]) {
      setErrors(validateClaim(updated));
    }
  };

  const handleBlur = (e) => {
    const { name } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    setErrors(validateClaim(form));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ claimReason: true, proofDetails: true, studentIdProvided: true });

    const validationErrors = validateClaim(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      await api.submitClaim({
        itemId: item._id,
        itemType,
        claimReason: form.claimReason,
        proofDetails: form.proofDetails,
        studentIdProvided: form.studentIdProvided,
      });
      setSuccess(true);
      if (onClaimed) onClaimed(item, itemType);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setSubmitError(err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
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
        zIndex: 1200,
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
          maxHeight: '90vh',
          overflowY: 'auto',
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
          }}
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
              Your claim has been recorded. Administrators will verify the proof and contact you.
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

            {itemType === 'FoundItem' && (conflictsLoading || conflicts.length > 0) && (
              <div
                style={{
                  background: 'var(--color-warning-bg)',
                  color: 'var(--color-warning)',
                  border: '1px solid var(--color-warning)',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  marginBottom: '18px',
                }}
              >
                {conflictsLoading ? (
                  <span>Checking for potential owner conflicts...</span>
                ) : (
                  <>
                    <div style={{ marginBottom: conflicts.length > 0 ? '6px' : 0 }}>
                      ⚠️ This item has a high-score match with another user&apos;s active lost report{conflicts.length > 1 ? `s (${conflicts.length})` : ''}:
                    </div>
                    {conflicts.map((c) => (
                      <div
                        key={c.pairKey}
                        style={{ fontWeight: '500', marginTop: '4px', color: 'var(--text-primary)' }}
                      >
                        • {c.lostItem?.itemName} — match score <strong>{c.score}</strong>
                      </div>
                    ))}
                    <div style={{ fontWeight: '500', marginTop: '8px', color: 'var(--color-warning)' }}>
                      There may already be a higher-relevance owner report; admins will review carefully.
                    </div>
                  </>
                )}
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
                onChange={handleInputChange}
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
                onChange={handleInputChange}
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
                onChange={handleInputChange}
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
                disabled={submitting || !form.claimReason || Object.keys(errors).length > 0}
              >
                {submitting ? 'Submitting...' : 'Submit Claim'}
              </button>
            </div>
          </form>
        )}
      </GlassCard>
    </div>
  );
};

export default ClaimModal;
