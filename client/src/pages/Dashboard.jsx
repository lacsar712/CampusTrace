import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import MetricCard from '../components/MetricCard';
import ItemCard from '../components/ItemCard';
import GlassCard from '../components/GlassCard';
import MatchList from '../components/MatchList';
import ClaimModal from '../components/ClaimModal';

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
  const [feedType, setFeedType] = useState('found'); // Default to 'found' since users claim found items!
  const [loading, setLoading] = useState(true);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Claim Modal State (form logic now lives in the shared ClaimModal component)
  const [selectedItem, setSelectedItem] = useState(null);

  // Possible Matches states
  const [matchCounts, setMatchCounts] = useState({}); // { [lostItemId]: number }
  const [matchModalItem, setMatchModalItem] = useState(null); // active lost item whose matches are shown
  const [matchList, setMatchList] = useState([]);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchError, setMatchError] = useState(null);

  // Fetch Items
  const fetchData = async () => {
    setLoading(true);
    try {
      const [lost, found] = await Promise.all([
        api.getLostItems(),
        api.getFoundItems()
      ]);
      setLostItems(lost.items || lost);
      setFoundItems(found.items || found);
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

  // Fetch possible-match counts for the active lost reports currently loaded.
  useEffect(() => {
    const activeIds = lostItems.filter((i) => i.status === 'active').map((i) => i._id);
    if (activeIds.length === 0) {
      setMatchCounts({});
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await api.getMatchCounts(activeIds);
        if (!cancelled) setMatchCounts(data.counts || {});
      } catch (err) {
        console.error('Error fetching match counts:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lostItems]);

  // Open the possible-matches panel for a given lost item.
  const handleOpenMatches = async (item) => {
    setMatchModalItem(item);
    setMatchList([]);
    setMatchError(null);
    setMatchLoading(true);
    try {
      const data = await api.getMatchesForLost(item._id);
      setMatchList(data.matches || []);
    } catch (err) {
      setMatchError(err.message || 'Failed to load possible matches');
    } finally {
      setMatchLoading(false);
    }
  };

  const handleCloseMatches = () => {
    setMatchModalItem(null);
    setMatchList([]);
    setMatchError(null);
  };

  // Mark a candidate pair as "Not relevant" — removes it from this modal and
  // decrements the badge count so the change is visible immediately.
  const handleDismissMatch = async (match) => {
    try {
      await api.dismissMatch(match.lostItemId, match.foundItemId);
      setMatchList((prev) => prev.filter((m) => m.pairKey !== match.pairKey));
      setMatchCounts((prev) => {
        const current = prev[match.lostItemId];
        if (typeof current !== 'number') return prev;
        return { ...prev, [match.lostItemId]: Math.max(0, current - 1) };
      });
    } catch (err) {
      setMatchError(err.message || 'Failed to mark as not relevant');
    }
  };

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
  const handleOpenClaimModal = (item) => {
    setSelectedItem(item);
  };

  const handleCloseClaimModal = () => {
    setSelectedItem(null);
  };

  // Reflect the claim locally once the shared ClaimModal reports success.
  const handleClaimSuccess = (item) => {
    if (feedType === 'found') {
      setFoundItems((prev) => prev.map((i) => (i._id === item._id ? { ...i, status: 'claimed' } : i)));
    } else {
      setLostItems((prev) => prev.map((i) => (i._id === item._id ? { ...i, status: 'matched' } : i)));
    }
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
                  matchCount={feedType === 'lost' ? matchCounts[item._id] : undefined}
                  onMatchClick={handleOpenMatches}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ─── POSSIBLE MATCHES OVERLAY MODAL ───────────────────────────── */}
      {matchModalItem && (
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
              maxWidth: '560px',
              maxHeight: '80vh',
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

            <h3 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '6px', color: 'var(--text-primary)' }}>
              ✨ Possible Matches
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '24px' }}>
              Found items that may match <strong style={{ color: 'var(--text-primary)' }}>{matchModalItem.itemName}</strong> ({matchModalItem.category}), ranked by score.
            </p>

            {matchError && (
              <div style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)', border: '1px solid var(--color-danger)', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', fontWeight: '600', marginBottom: '18px' }}>
                ⚠️ {matchError}
              </div>
            )}

            {matchLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '24px 0' }}>
                <div style={{ width: '34px', height: '34px', border: '3px solid var(--glass-border)', borderTop: '3px solid var(--accent-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <p style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Scoring candidates...</p>
              </div>
            ) : (
              <MatchList matches={matchList} onDismiss={handleDismissMatch} emptyText="No found items currently meet the match threshold." />
            )}
          </GlassCard>
        </div>
      )}

      {/* ─── CLAIM SUBMISSION MODAL (shared component) ────────────────── */}
      {selectedItem && (
        <ClaimModal
          item={selectedItem}
          itemType={feedType === 'lost' ? 'LostItem' : 'FoundItem'}
          defaultStudentId={user?.studentId || ''}
          onClose={handleCloseClaimModal}
          onSuccess={handleClaimSuccess}
          submitClaim={api.submitClaim}
        />
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
