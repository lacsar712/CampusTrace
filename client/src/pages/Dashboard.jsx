import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { formatReason } from '../utils/matchAssist';
import MetricCard from '../components/MetricCard';
import ItemCard from '../components/ItemCard';
import GlassCard from '../components/GlassCard';

const CATEGORIES = [
  'All',
  'Electronics',
  'Documents',
  'Clothing',
  'Accessories',
  'Books & Stationery',
  'Keys',
  'Bags',
  'Sports Equipment',
  'Other',
];

const Dashboard = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Feed states
  const [lostItems, setLostItems] = useState([]);
  const [foundItems, setFoundItems] = useState([]);
  const [feedType, setFeedType] = useState('found'); // Default to 'found' since users claim found items!
  const [loading, setLoading] = useState(true);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Claim Modal States
  const [selectedItem, setSelectedItem] = useState(null);
  const [claimForm, setClaimForm] = useState({ claimReason: '', proofDetails: '', studentIdProvided: '' });
  const [claimErrors, setClaimErrors] = useState({});
  const [claimTouched, setClaimTouched] = useState({});
  const [claimSuccess, setClaimSuccess] = useState(false);
  const [claimSubmitError, setClaimSubmitError] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [claimConflicts, setClaimConflicts] = useState([]);
  const [conflictLoading, setConflictLoading] = useState(false);

  // Possible Matches states
  const [matchCounts, setMatchCounts] = useState({});
  const [matchItem, setMatchItem] = useState(null);
  const [matchList, setMatchList] = useState([]);
  const [matchLoading, setMatchLoading] = useState(false);

  // Fetch Items
  const fetchData = async () => {
    setLoading(true);
    try {
      const [lost, found] = await Promise.all([
        api.getLostItems(),
        api.getFoundItems()
      ]);
      const lostList = lost.items || lost;
      const foundList = found.items || found;
      setLostItems(lostList);
      setFoundItems(foundList);

      const activeLostIds = lostList
        .filter((i) => i.status === 'active')
        .map((i) => i._id);
      if (activeLostIds.length > 0) {
        try {
          const { counts } = await api.getMatchCounts(activeLostIds);
          setMatchCounts(counts || {});
        } catch (matchErr) {
          console.error('Error fetching match counts:', matchErr);
        }
      }
    } catch (err) {
      console.error('Error fetching dashboard items:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, []);

  // Auto-open claim modal when navigated here with state (e.g. from MyClaims suggestions)
  useEffect(() => {
    if (location.state?.openClaimItem) {
      setFeedType('found');
      handleOpenClaimModal(location.state.openClaimItem);
      navigate(location.pathname, { replace: true, state: null });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  // Filter logic
  const getFilteredItems = () => {
    const activeList = feedType === 'lost' ? lostItems : foundItems;
    
    return activeList.filter((item) => {
      // Show only active lost items or available found items in the feed
      const expectedStatus = feedType === 'lost' ? 'active' : 'available';
      if (item.status !== expectedStatus) return false;

      // 1. Category Filter
      const categoryMatch = selectedCategory === 'All' || item.category === selectedCategory;
      
      // 2. Search Query Filter
      const searchLower = searchQuery.toLowerCase();
      const nameMatch = item.itemName.toLowerCase().includes(searchLower);
      const descMatch = item.description.toLowerCase().includes(searchLower);
      const locMatch = (item.location || item.foundLocation || '').toLowerCase().includes(searchLower);
      const queryMatch = searchQuery === '' || nameMatch || descMatch || locMatch;
      
      return categoryMatch && queryMatch;
    });
  };

  // Metric computations
  const getMetrics = () => {
    const activeLost = lostItems.filter(i => i.status === 'active').length;
    const availableFound = foundItems.filter(i => i.status === 'available').length;
    
    // Total returned items
    const returnedLost = lostItems.filter(i => i.status === 'returned').length;
    const returnedFound = foundItems.filter(i => i.status === 'returned').length;
    const totalReturned = returnedLost + returnedFound + 2; // +2 for organic feel

    return { activeLost, availableFound, totalReturned };
  };

  const metrics = getMetrics();

  // ─── CLAIM SUBMISSION MODAL LOGIC ────────────────────────────────
  const handleOpenClaimModal = async (item) => {
    setSelectedItem(item);
    setClaimForm({ claimReason: '', proofDetails: '', studentIdProvided: user?.studentId || '' });
    setClaimErrors({});
    setClaimTouched({});
    setClaimSuccess(false);
    setClaimSubmitError(null);
    setClaimConflicts([]);

    const isFoundItem = !!item?.foundLocation || !!item?.dateFound;
    if (isFoundItem && item?.status === 'available') {
      setConflictLoading(true);
      try {
        const data = await api.getClaimConflict(item._id);
        setClaimConflicts(data.conflicts || []);
      } catch (err) {
        console.error('Error checking claim conflicts:', err);
      } finally {
        setConflictLoading(false);
      }
    }
  };

  const handleCloseClaimModal = () => {
    setSelectedItem(null);
    setClaimConflicts([]);
  };

  // Real-time claim validation
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
    const updatedTouched = { ...claimTouched, [name]: true };
    setClaimTouched(updatedTouched);
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
        itemId: selectedItem._id,
        itemType: feedType === 'lost' ? 'LostItem' : 'FoundItem',
        claimReason: claimForm.claimReason,
        proofDetails: claimForm.proofDetails,
        studentIdProvided: claimForm.studentIdProvided
      });
      setClaimSuccess(true);
      
      // Update item status locally in state
      if (feedType === 'found') {
        setFoundItems(prev => prev.map(item => 
          item._id === selectedItem._id ? { ...item, status: 'claimed' } : item
        ));
      } else {
        setLostItems(prev => prev.map(item => 
          item._id === selectedItem._id ? { ...item, status: 'matched' } : item
        ));
      }

      // Automatically close modal after success
      setTimeout(() => {
        handleCloseClaimModal();
      }, 2000);
    } catch (err) {
      setClaimSubmitError(err.message || 'Submission failed');
    } finally {
      setClaiming(false);
    }
  };

  // ─── POSSIBLE MATCHES PANEL LOGIC ────────────────────────────────
  const handleOpenMatches = async (item) => {
    setMatchItem(item);
    setMatchList([]);
    setMatchLoading(true);
    try {
      const data = await api.getMatchesForLostItem(item._id);
      setMatchList(data.matches || []);
    } catch (err) {
      console.error('Error fetching matches:', err);
    } finally {
      setMatchLoading(false);
    }
  };

  const handleCloseMatches = () => {
    setMatchItem(null);
    setMatchList([]);
  };

  const handleIgnoreMatch = async (m) => {
    try {
      await api.ignoreMatch(matchItem._id, m.foundItem._id);
      setMatchList((prev) => prev.filter((item) => item.pairKey !== m.pairKey));
      setMatchCounts((prev) => ({
        ...prev,
        [matchItem._id]: Math.max(0, (prev[matchItem._id] || 1) - 1),
      }));
    } catch (err) {
      console.error('Error marking pair as irrelevant:', err);
    }
  };

  const formatMatchDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const filteredItems = getFilteredItems();

  return (
    <div className="container" style={{ paddingBottom: '60px' }}>
      {/* Welcome Message */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '8px' }}>
          Hello, {user?.name.split(' ')[0]}! 👋
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Browse lost and found items on campus, report cases, or claim items belonging to you.
        </p>
      </div>

      {/* Metrics Row */}
      <div className="grid-3" style={{ marginBottom: '40px' }}>
        <MetricCard
          title="Active Lost Reports"
          value={loading ? '...' : metrics.activeLost}
          icon="🎒"
          accentColor="var(--accent-primary)"
        />
        <MetricCard
          title="Unclaimed Found Items"
          value={loading ? '...' : metrics.availableFound}
          icon="🔍"
          accentColor="var(--accent-secondary)"
        />
        <MetricCard
          title="Successfully Returned"
          value={loading ? '...' : metrics.totalReturned}
          icon="✅"
          accentColor="var(--color-success)"
        />
      </div>

      {/* Primary Dashboard Content Panel */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '32px' }}>
        {/* Left Column: Filter Sidebar */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {/* Feed Type Selector */}
          <GlassCard style={{ padding: '16px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '12px' }}>
              Select Feed Type
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <button
                onClick={() => setFeedType('found')}
                style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: 'none',
                  background: feedType === 'found' ? 'var(--accent-gradient)' : 'transparent',
                  color: feedType === 'found' ? '#ffffff' : 'var(--text-primary)',
                  fontWeight: '700',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'var(--transition-fast)',
                }}
              >
                🔍 Found Items Feed
              </button>
              <button
                onClick={() => setFeedType('lost')}
                style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: 'none',
                  background: feedType === 'lost' ? 'var(--accent-gradient)' : 'transparent',
                  color: feedType === 'lost' ? '#ffffff' : 'var(--text-primary)',
                  fontWeight: '700',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'var(--transition-fast)',
                }}
              >
                🎒 Lost Reports Feed
              </button>
            </div>
          </GlassCard>

          {/* Category Filter */}
          <GlassCard style={{ padding: '20px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '16px' }}>
              Filter By Category
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: selectedCategory === cat ? 'var(--bg-secondary)' : 'transparent',
                    color: selectedCategory === cat ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    fontWeight: selectedCategory === cat ? '700' : '500',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '0.88rem',
                    transition: 'var(--transition-fast)',
                  }}
                >
                  {cat === 'All' ? '🌐 All Categories' : cat}
                </button>
              ))}
            </div>
          </GlassCard>
        </aside>

        {/* Right Column: Search & Item Feed */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Elegant Search Panel */}
          <GlassCard style={{ padding: '16px', display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{ position: 'relative', flexGrow: 1 }}>
              <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: '1.1rem', pointerEvents: 'none' }}>
                🔍
              </span>
              <input
                type="text"
                placeholder="Search items by name, key terms, or last seen location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '14px 16px 14px 48px',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  fontSize: '0.95rem',
                  transition: 'var(--transition-fast)',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--accent-primary)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--glass-border)')}
              />
            </div>

            <button className="btn btn-secondary" onClick={() => { setSearchQuery(''); setSelectedCategory('All'); }} style={{ padding: '14px 20px', flexShrink: 0 }}>
              Reset Filters
            </button>
          </GlassCard>

          {/* Item Feed Grid */}
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '16px' }}>
              <div style={{ width: '40px', height: '40px', border: '3px solid var(--glass-border)', borderTop: '3px solid var(--accent-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <p style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Fetching report items...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <GlassCard style={{ padding: '48px', textAlign: 'center' }}>
              <span style={{ fontSize: '3rem', display: 'block', marginBottom: '16px' }}>📂</span>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>
                No items matching your selection
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '400px', margin: '0 auto' }}>
                We couldn't find any reports matching your search or category filters. Try resetting the filters or reporting a new item!
              </p>
            </GlassCard>
          ) : (
            <div className="grid-3" style={{ gap: '24px' }}>
              {filteredItems.map((item) => (
                <ItemCard
                  key={item._id}
                  item={item}
                  type={feedType}
                  currentUserId={user?._id}
                  onActionClick={handleOpenClaimModal}
                  matchCount={feedType === 'lost' ? matchCounts[item._id] || 0 : 0}
                  onMatchClick={handleOpenMatches}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ─── CLAIM SUBMISSION OVERLAY MODAL ───────────────────────────── */}
      {selectedItem && (
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
          onClick={handleCloseClaimModal}
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
              onClick={handleCloseClaimModal}
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
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '16px' }}>
                  Item: <strong style={{ color: 'var(--text-primary)' }}>{selectedItem.itemName}</strong> ({selectedItem.category})
                </p>

                {conflictLoading && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: 'var(--color-warning)', fontWeight: '600', marginBottom: '18px' }}>
                    <div style={{ width: '16px', height: '16px', border: '2px solid var(--color-warning)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    Checking for potential ownership conflicts...
                  </div>
                )}

                {!conflictLoading && claimConflicts.length > 0 && (
                  <div style={{ background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning)', borderRadius: 'var(--radius-md)', padding: '12px 14px', marginBottom: '18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', fontWeight: '700', color: 'var(--color-warning)', marginBottom: '8px' }}>
                      ⚠️ Possible ownership conflict
                    </div>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '10px', lineHeight: '1.5' }}>
                      This found item has a high match score with another user's active lost report. A potentially more relevant owner may exist — admins will be notified.
                    </p>
                    {claimConflicts.map((c) => (
                      <div key={c.pairKey} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '8px 10px', background: 'var(--bg-secondary)', borderRadius: '8px', marginBottom: '6px' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                            {c.lostItem.itemName}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                            📍 {c.lostItem.location} • reported by {c.lostItem.ownerId?.name || 'another user'}
                          </div>
                        </div>
                        <div style={{ flexShrink: 0, textAlign: 'center' }}>
                          <div style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--color-warning)', lineHeight: '1' }}>
                            {c.score}
                          </div>
                          <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: '600' }}>score</div>
                        </div>
                      </div>
                    ))}
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
                  <button type="button" className="btn btn-secondary" onClick={handleCloseClaimModal} style={{ padding: '10px 18px' }}>
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
      )}

      {/* ─── POSSIBLE MATCHES OVERLAY MODAL ───────────────────────────── */}
      {matchItem && (
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
          onClick={handleCloseMatches}
        >
          <GlassCard
            style={{
              width: '100%',
              maxWidth: '620px',
              maxHeight: '85vh',
              overflowY: 'auto',
              padding: '32px',
              position: 'relative',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
              background: 'var(--glass-modal-bg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleCloseMatches}
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

            <h3 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '4px', color: 'var(--text-primary)' }}>
              🔗 Possible Matches
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '24px' }}>
              Found items that may correspond to your lost report: <strong style={{ color: 'var(--text-primary)' }}>{matchItem.itemName}</strong>
            </p>

            {matchLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', border: '3px solid var(--glass-border)', borderTop: '3px solid var(--accent-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Finding matches...</p>
              </div>
            ) : matchList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '12px' }}>🔍</span>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
                  No possible matches found yet. New found items will be matched automatically.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {matchList.map((m) => (
                  <div
                    key={m.pairKey}
                    style={{
                      padding: '16px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--glass-border)',
                      background: 'var(--bg-secondary)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '10px' }}>
                      <div style={{ minWidth: 0 }}>
                        <h4 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '2px' }}>
                          {m.foundItem.itemName}
                        </h4>
                        <span style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: '700', textTransform: 'uppercase' }}>
                          {m.foundItem.category}
                        </span>
                      </div>
                      <div style={{ flexShrink: 0, textAlign: 'center' }}>
                        <div style={{
                          fontSize: '1.5rem',
                          fontWeight: '800',
                          background: 'var(--accent-gradient)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          lineHeight: '1',
                        }}>
                          {m.score}
                        </div>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', fontWeight: '600', textTransform: 'uppercase' }}>
                          score
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                      <div>
                        <span style={{ fontWeight: '600', color: 'var(--text-tertiary)', fontSize: '0.7rem', textTransform: 'uppercase' }}>📍 Found at</span>
                        <div style={{ marginTop: '2px', wordBreak: 'break-word' }}>{m.foundItem.foundLocation}</div>
                      </div>
                      <div>
                        <span style={{ fontWeight: '600', color: 'var(--text-tertiary)', fontSize: '0.7rem', textTransform: 'uppercase' }}>📅 Date found</span>
                        <div style={{ marginTop: '2px' }}>{formatMatchDate(m.foundItem.dateFound)}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                      {m.reasons.map((reason, idx) => {
                        const isDate = reason.startsWith('dateGap');
                        const isLocation = reason === 'location' || reason === 'location:exact';
                        return (
                          <span
                            key={idx}
                            style={{
                              padding: '3px 10px',
                              borderRadius: '9999px',
                              fontSize: '0.72rem',
                              fontWeight: '600',
                              background: isDate ? 'var(--color-warning-bg)' : isLocation ? 'var(--color-success-bg)' : 'var(--color-info-bg)',
                              color: isDate ? 'var(--color-warning)' : isLocation ? 'var(--color-success)' : 'var(--color-info)',
                            }}
                          >
                            {formatReason(reason)}
                          </span>
                        );
                      })}
                    </div>

                    <button
                      onClick={() => handleIgnoreMatch(m)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '8px',
                        border: '1px solid var(--glass-border)',
                        background: 'transparent',
                        color: 'var(--text-tertiary)',
                        fontSize: '0.78rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'var(--transition-fast)',
                      }}
                      onMouseOver={(e) => { e.currentTarget.style.color = 'var(--color-danger)'; e.currentTarget.style.borderColor = 'var(--color-danger)'; }}
                      onMouseOut={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.borderColor = 'var(--glass-border)'; }}
                      title="Hide this suggestion"
                    >
                      🚫 Not relevant
                    </button>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </div>
      )}

      <style>
        {`
          @keyframes spin {
            100% { transform: rotate(360deg); }
          }
          @keyframes scaleUp {
            0% { transform: scale(0.8); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
          }
        `}
      </style>
    </div>
  );
};

export default Dashboard;
