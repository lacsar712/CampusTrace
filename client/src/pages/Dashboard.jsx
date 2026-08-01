import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import MetricCard from '../components/MetricCard';
import ItemCard from '../components/ItemCard';
import GlassCard from '../components/GlassCard';
import ClaimModal from '../components/ClaimModal';
import { reasonLabels } from '../utils/matchLabels';

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

  // Feed states
  const [lostItems, setLostItems] = useState([]);
  const [foundItems, setFoundItems] = useState([]);
  const [feedType, setFeedType] = useState('found');
  const [loading, setLoading] = useState(true);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Claim Modal state
  const [claimItem, setClaimItem] = useState(null);

  // Possible Matches states
  const [matchCounts, setMatchCounts] = useState({});
  const [matchesPanelItem, setMatchesPanelItem] = useState(null);
  const [matchesList, setMatchesList] = useState([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [matchesError, setMatchesError] = useState(null);
  const [dismissingKey, setDismissingKey] = useState(null);

  const refreshMatchCounts = async (activeLostIds) => {
    if (!activeLostIds || activeLostIds.length === 0) {
      setMatchCounts({});
      return;
    }
    try {
      const countsRes = await api.getMatchCountsForLost(activeLostIds);
      setMatchCounts(countsRes.counts || {});
    } catch (err) {
      console.error('Error fetching match counts:', err);
    }
  };

  // Fetch Items
  const fetchData = async () => {
    setLoading(true);
    try {
      const [lost, found] = await Promise.all([
        api.getLostItems(),
        api.getFoundItems()
      ]);
      const lostList = lost.items || lost;
      setLostItems(lostList);
      setFoundItems(found.items || found);

      const activeLostIds = lostList
        .filter((i) => i.status === 'active')
        .map((i) => i._id);
      await refreshMatchCounts(activeLostIds);
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

  // Filter logic
  const getFilteredItems = () => {
    const activeList = feedType === 'lost' ? lostItems : foundItems;

    return activeList.filter((item) => {
      const expectedStatus = feedType === 'lost' ? 'active' : 'available';
      if (item.status !== expectedStatus) return false;

      const categoryMatch = selectedCategory === 'All' || item.category === selectedCategory;

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

    const returnedLost = lostItems.filter(i => i.status === 'returned').length;
    const returnedFound = foundItems.filter(i => i.status === 'returned').length;
    const totalReturned = returnedLost + returnedFound + 2;

    return { activeLost, availableFound, totalReturned };
  };

  const metrics = getMetrics();

  const handleOpenClaimModal = (item) => {
    setClaimItem(item);
  };

  const handleCloseClaimModal = () => {
    setClaimItem(null);
  };

  const handleClaimSuccess = (item, itemType) => {
    if (itemType === 'FoundItem') {
      setFoundItems(prev => prev.map(i =>
        i._id === item._id ? { ...i, status: 'claimed' } : i
      ));
    } else {
      setLostItems(prev => prev.map(i =>
        i._id === item._id ? { ...i, status: 'matched' } : i
      ));
      setMatchCounts(prev => {
        const next = { ...prev };
        delete next[item._id];
        return next;
      });
    }
  };

  // ─── POSSIBLE MATCHES PANEL ──────────────────────────────────────
  const handleOpenMatches = async (item) => {
    setMatchesPanelItem(item);
    setMatchesList([]);
    setMatchesError(null);
    setMatchesLoading(true);
    try {
      const data = await api.getMatchesForLost(item._id);
      setMatchesList(data.matches || []);
    } catch (err) {
      setMatchesError(err.message || 'Failed to load possible matches');
    } finally {
      setMatchesLoading(false);
    }
  };

  const handleCloseMatches = () => {
    setMatchesPanelItem(null);
    setMatchesList([]);
    setMatchesError(null);
    setDismissingKey(null);
  };

  const handleDismissMatch = async (pairKey) => {
    setDismissingKey(pairKey);
    try {
      await api.dismissMatch(pairKey);
      setMatchesList((prev) => prev.filter((m) => m.pairKey !== pairKey));
      if (matchesPanelItem) {
        setMatchCounts((prev) => ({
          ...prev,
          [matchesPanelItem._id]: Math.max(0, (prev[matchesPanelItem._id] || 1) - 1),
        }));
      }
    } catch (err) {
      setMatchesError(err.message || 'Failed to mark pair as not relevant');
    } finally {
      setDismissingKey(null);
    }
  };

  const filteredItems = getFilteredItems();
  const claimItemType = feedType === 'lost' ? 'LostItem' : 'FoundItem';

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
                  onViewMatches={feedType === 'lost' ? handleOpenMatches : undefined}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ─── CLAIM SUBMISSION MODAL (shared) ─────────────────────────── */}
      {claimItem && (
        <ClaimModal
          item={claimItem}
          itemType={claimItemType}
          onClose={handleCloseClaimModal}
          onClaimed={handleClaimSuccess}
        />
      )}

      {/* ─── POSSIBLE MATCHES PANEL ──────────────────────────────────── */}
      {matchesPanelItem && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(8px)',
            zIndex: 1100,
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
              maxWidth: '640px',
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

            <span style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              🎯 Possible Matches
            </span>
            <h3 style={{ fontSize: '1.4rem', fontWeight: '800', margin: '6px 0 4px', color: 'var(--text-primary)' }}>
              {matchesPanelItem.itemName}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '20px' }}>
              Found-item candidates ranked by match score (minimum 60).
            </p>

            {matchesLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: '12px', color: 'var(--text-secondary)' }}>
                <div style={{ width: '32px', height: '32px', border: '3px solid var(--glass-border)', borderTop: '3px solid var(--accent-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                Calculating matches...
              </div>
            ) : matchesError ? (
              <div style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)', border: '1px solid var(--color-danger)', padding: '12px 16px', borderRadius: 'var(--radius-md)', fontSize: '0.88rem', fontWeight: '600' }}>
                ⚠️ {matchesError}
              </div>
            ) : matchesList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-secondary)' }}>
                <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '12px' }}>🔍</span>
                No possible matches found at this time.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {matchesList.map((m) => (
                  <div
                    key={m.pairKey}
                    style={{
                      padding: '14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--glass-border)',
                      background: 'var(--bg-primary)',
                    }}
                  >
                    <div style={{ display: 'flex', gap: '14px' }}>
                      {m.foundItem?.image?.url ? (
                        <img src={m.foundItem.image.url} alt={m.foundItem.itemName} style={{ width: '64px', height: '64px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: '64px', height: '64px', borderRadius: '10px', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>📦</div>
                      )}
                      <div style={{ flexGrow: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          <h4 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                            {m.foundItem?.itemName}
                          </h4>
                          <span style={{ background: 'var(--accent-gradient)', color: '#fff', padding: '4px 10px', borderRadius: '9999px', fontSize: '0.78rem', fontWeight: '800', flexShrink: 0 }}>
                            {m.score}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                          📍 {m.foundItem?.foundLocation} • 📅 {m.foundItem ? new Date(m.foundItem.dateFound).toLocaleDateString() : ''}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                          {reasonLabels(m.reasons).map((label, idx) => (
                            <span
                              key={`${m.pairKey}-${idx}`}
                              style={{
                                fontSize: '0.7rem',
                                fontWeight: '700',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                background: 'var(--color-success-bg)',
                                color: 'var(--color-success)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.3px',
                              }}
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                        onClick={() => handleDismissMatch(m.pairKey)}
                        disabled={dismissingKey === m.pairKey}
                      >
                        {dismissingKey === m.pairKey ? 'Hiding...' : 'Not relevant'}
                      </button>
                    </div>
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
