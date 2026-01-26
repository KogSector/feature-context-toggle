import { useState, useEffect, useCallback, useMemo } from 'react';

/**
 * Feature Toggle Type Definitions
 */
interface DemoUser {
    id: string;
    email: string;
    name: string;
    roles: string[];
    sessionId: string;
}

interface FeatureToggle {
    enabled: boolean;
    description: string;
    category: string;
    categoryType?: 'devOnly' | 'userFacing' | 'ops';
    demoUser?: DemoUser;
    [key: string]: unknown;
}

interface ToggleState {
    [key: string]: FeatureToggle;
}

interface AuditEntry {
    id: number;
    toggle_name: string;
    action: 'create' | 'update' | 'delete';
    previous_value: boolean | null;
    new_value: boolean | null;
    changed_by: string;
    changed_at: string;
    notes: string | null;
}

interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    errors?: string[];
    timestamp: string;
}

/**
 * Constants - loaded from environment variables
 */
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/toggles';
const POLL_INTERVAL = parseInt(import.meta.env.VITE_POLL_INTERVAL || '10000');

const categoryIcons: Record<string, string> = {
    authentication: '🔐',
    data: '💾',
    infrastructure: '🏗️',
    debugging: '🐛',
    observability: '📊',
    performance: '⚡',
    security: '🛡️',
    'user-experience': '✨',
    default: '🎛️',
};

const categoryTypeColors: Record<string, string> = {
    devOnly: 'category-type-dev',
    userFacing: 'category-type-user',
    ops: 'category-type-ops',
};

/**
 * Format toggle name for display
 */
function formatToggleName(name: string): string {
    return name
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .trim();
}

/**
 * Format date for display
 */
function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleString();
}

/**
 * Toggle Card Component
 */
function ToggleCard({
    name,
    toggle,
    onToggle,
    onDelete,
    isUpdating
}: {
    name: string;
    toggle: FeatureToggle;
    onToggle: (name: string, enabled: boolean) => void;
    onDelete: (name: string) => void;
    isUpdating: boolean;
}) {
    const icon = categoryIcons[toggle.category] || categoryIcons.default;
    const typeClass = categoryTypeColors[toggle.categoryType || 'ops'] || '';

    return (
        <div className={`toggle-card ${toggle.enabled ? 'enabled' : ''}`}>
            <div className="toggle-card-content">
                <div className="toggle-info">
                    <div className="toggle-header">
                        <span className="toggle-icon">{icon}</span>
                        <span className="toggle-name">{formatToggleName(name)}</span>
                        {toggle.categoryType && (
                            <span className={`toggle-type-badge ${typeClass}`}>
                                {toggle.categoryType}
                            </span>
                        )}
                    </div>
                    <p className="toggle-description">{toggle.description}</p>
                    <div className="toggle-meta">
                        <span className="toggle-category">
                            📁 {toggle.category}
                        </span>
                        <div className={`toggle-status ${toggle.enabled ? 'enabled' : 'disabled'}`}>
                            <span className="status-dot" />
                            {toggle.enabled ? 'Enabled' : 'Disabled'}
                        </div>
                    </div>
                </div>

                <div className="toggle-actions">
                    <label className="toggle-switch">
                        <input
                            type="checkbox"
                            checked={toggle.enabled}
                            onChange={(e) => onToggle(name, e.target.checked)}
                            disabled={isUpdating}
                        />
                        <span className="toggle-slider" />
                    </label>
                    <button
                        className="delete-btn"
                        onClick={() => onDelete(name)}
                        title="Delete toggle"
                    >
                        🗑️
                    </button>
                </div>
            </div>

            {name === 'authBypass' && toggle.enabled && toggle.demoUser && (
                <div className="demo-user-info">
                    <h4>👤 Demo User Active</h4>
                    <pre>{JSON.stringify(toggle.demoUser, null, 2)}</pre>
                </div>
            )}
        </div>
    );
}

/**
 * Create Toggle Form Component
 */
function CreateToggleForm({
    onSubmit,
    onCancel
}: {
    onSubmit: (data: {
        name: string;
        description: string;
        category: string;
        categoryType: 'devOnly' | 'userFacing' | 'ops';
        enabled: boolean;
    }) => void;
    onCancel: () => void;
}) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('debugging');
    const [categoryType, setCategoryType] = useState<'devOnly' | 'userFacing' | 'ops'>('ops');
    const [enabled, setEnabled] = useState(false);
    const [errors, setErrors] = useState<string[]>([]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const newErrors: string[] = [];

        if (!/^[a-z][a-zA-Z0-9]*$/.test(name)) {
            newErrors.push('Name must be camelCase (start lowercase, alphanumeric only)');
        }
        if (name.length < 3) {
            newErrors.push('Name must be at least 3 characters');
        }
        if (description.length < 10) {
            newErrors.push('Description must be at least 10 characters');
        }

        if (newErrors.length > 0) {
            setErrors(newErrors);
            return;
        }

        onSubmit({ name, description, category, categoryType, enabled });
    };

    return (
        <form className="create-toggle-form" onSubmit={handleSubmit}>
            <h3>➕ Create New Toggle</h3>

            {errors.length > 0 && (
                <div className="form-errors">
                    {errors.map((err, i) => <p key={i}>{err}</p>)}
                </div>
            )}

            <div className="form-group">
                <label htmlFor="name">Toggle Name (camelCase)</label>
                <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="myNewToggle"
                    required
                />
            </div>

            <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What does this toggle control?"
                    required
                />
            </div>

            <div className="form-row">
                <div className="form-group">
                    <label htmlFor="category">Category</label>
                    <select
                        id="category"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                    >
                        <option value="authentication">Authentication</option>
                        <option value="data">Data</option>
                        <option value="infrastructure">Infrastructure</option>
                        <option value="debugging">Debugging</option>
                        <option value="observability">Observability</option>
                        <option value="performance">Performance</option>
                        <option value="security">Security</option>
                        <option value="user-experience">User Experience</option>
                    </select>
                </div>

                <div className="form-group">
                    <label htmlFor="categoryType">Type</label>
                    <select
                        id="categoryType"
                        value={categoryType}
                        onChange={(e) => setCategoryType(e.target.value as 'devOnly' | 'userFacing' | 'ops')}
                    >
                        <option value="devOnly">Dev Only</option>
                        <option value="userFacing">User Facing</option>
                        <option value="ops">Ops</option>
                    </select>
                </div>
            </div>

            <div className="form-group checkbox-group">
                <label>
                    <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => setEnabled(e.target.checked)}
                    />
                    Enable immediately
                </label>
            </div>

            <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={onCancel}>
                    Cancel
                </button>
                <button type="submit" className="btn-primary">
                    Create Toggle
                </button>
            </div>
        </form>
    );
}

/**
 * Audit Log Component
 */
function AuditLog({ entries }: { entries: AuditEntry[] }) {
    if (entries.length === 0) {
        return (
            <div className="audit-empty">
                <p>No audit entries yet</p>
            </div>
        );
    }

    return (
        <div className="audit-log">
            <h3>📋 Recent Activity</h3>
            <div className="audit-entries">
                {entries.map((entry) => (
                    <div key={entry.id} className={`audit-entry action-${entry.action}`}>
                        <div className="audit-action">
                            {entry.action === 'create' && '➕'}
                            {entry.action === 'update' && '✏️'}
                            {entry.action === 'delete' && '🗑️'}
                        </div>
                        <div className="audit-details">
                            <span className="audit-toggle">{formatToggleName(entry.toggle_name)}</span>
                            <span className="audit-desc">
                                {entry.action === 'update' && (
                                    <>changed from {entry.previous_value?.toString()} to {entry.new_value?.toString()}</>
                                )}
                                {entry.action === 'create' && 'created'}
                                {entry.action === 'delete' && 'deleted'}
                            </span>
                        </div>
                        <div className="audit-meta">
                            <span className="audit-by">{entry.changed_by}</span>
                            <span className="audit-time">{formatDate(entry.changed_at)}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

/**
 * Main App Component
 */
function App() {
    const [toggles, setToggles] = useState<ToggleState | null>(null);
    const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [updatingToggle, setUpdatingToggle] = useState<string | null>(null);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [showAuditLog, setShowAuditLog] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [filterType, setFilterType] = useState<string>('all');

    /**
     * Fetch all toggles from API
     */
    const fetchToggles = useCallback(async () => {
        try {
            setError(null);
            const response = await fetch(API_BASE);
            const data: ApiResponse<ToggleState> = await response.json();

            if (data.success && data.data) {
                setToggles(data.data);
            } else {
                throw new Error(data.error || 'Failed to fetch toggles');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, []);

    /**
     * Fetch audit log
     */
    const fetchAuditLog = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE}/audit?limit=20`);
            const data: ApiResponse<AuditEntry[]> = await response.json();
            if (data.success && data.data) {
                setAuditLog(data.data);
            }
        } catch (err) {
            console.warn('Failed to fetch audit log:', err);
        }
    }, []);

    /**
     * Update a toggle's enabled state
     */
    const handleToggle = async (name: string, enabled: boolean) => {
        setUpdatingToggle(name);

        try {
            const response = await fetch(`${API_BASE}/${name}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled }),
            });

            const data: ApiResponse<FeatureToggle & { name: string }> = await response.json();

            if (data.success && data.data) {
                setToggles(prev => prev ? {
                    ...prev,
                    [name]: { ...prev[name], enabled: data.data!.enabled },
                } : null);
                fetchAuditLog();
            } else {
                throw new Error(data.error || 'Failed to update toggle');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
            fetchToggles();
        } finally {
            setUpdatingToggle(null);
        }
    };

    /**
     * Create a new toggle
     */
    const handleCreate = async (data: {
        name: string;
        description: string;
        category: string;
        categoryType: 'devOnly' | 'userFacing' | 'ops';
        enabled: boolean;
    }) => {
        try {
            const response = await fetch(API_BASE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            const result: ApiResponse<FeatureToggle & { name: string }> = await response.json();

            if (result.success && result.data) {
                setShowCreateForm(false);
                fetchToggles();
                fetchAuditLog();
            } else {
                setError(result.errors?.join(', ') || result.error || 'Failed to create toggle');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        }
    };

    /**
     * Delete a toggle
     */
    const handleDelete = async (name: string) => {
        if (!confirm(`Are you sure you want to delete "${formatToggleName(name)}"?`)) {
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/${name}`, {
                method: 'DELETE',
            });

            const data: ApiResponse<{ deleted: string }> = await response.json();

            if (data.success) {
                fetchToggles();
                fetchAuditLog();
            } else {
                throw new Error(data.error || 'Failed to delete toggle');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        }
    };

    // Initial fetch and polling
    useEffect(() => {
        fetchToggles();
        fetchAuditLog();

        const interval = setInterval(() => {
            fetchToggles();
        }, POLL_INTERVAL);

        return () => clearInterval(interval);
    }, [fetchToggles, fetchAuditLog]);

    // Get unique categories for filter
    const categories = useMemo(() => {
        if (!toggles) return [];
        return [...new Set(Object.values(toggles).map(t => t.category))];
    }, [toggles]);

    // Filter and search toggles
    const filteredToggles = useMemo(() => {
        if (!toggles) return [];

        return Object.entries(toggles).filter(([name, toggle]) => {
            // Search filter
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const matchesName = name.toLowerCase().includes(query);
                const matchesDesc = toggle.description.toLowerCase().includes(query);
                if (!matchesName && !matchesDesc) return false;
            }

            // Category filter
            if (filterCategory !== 'all' && toggle.category !== filterCategory) {
                return false;
            }

            // Type filter
            if (filterType !== 'all' && toggle.categoryType !== filterType) {
                return false;
            }

            return true;
        });
    }, [toggles, searchQuery, filterCategory, filterType]);

    // Count enabled toggles
    const enabledCount = toggles
        ? Object.values(toggles).filter(t => t.enabled).length
        : 0;

    return (
        <div className="app">
            <header className="header">
                <span className="header-icon">🎛️</span>
                <h1>Feature Context Toggle</h1>
                <p>Developer dashboard for ConFuse platform</p>
                <div className="header-badge">
                    {enabledCount} toggle{enabledCount !== 1 ? 's' : ''} active
                </div>
            </header>

            {/* Toolbar */}
            <div className="toolbar">
                <div className="search-box">
                    <span className="search-icon">🔍</span>
                    <input
                        type="text"
                        placeholder="Search toggles..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="filters">
                    <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                    >
                        <option value="all">All Categories</option>
                        {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>

                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                    >
                        <option value="all">All Types</option>
                        <option value="devOnly">Dev Only</option>
                        <option value="userFacing">User Facing</option>
                        <option value="ops">Ops</option>
                    </select>
                </div>

                <div className="toolbar-actions">
                    <button
                        className="btn-secondary"
                        onClick={() => setShowAuditLog(!showAuditLog)}
                    >
                        {showAuditLog ? '📋 Hide Log' : '📋 Audit Log'}
                    </button>
                    <button
                        className="btn-primary"
                        onClick={() => setShowCreateForm(true)}
                    >
                        ➕ New Toggle
                    </button>
                </div>
            </div>

            <main>
                {/* Create Form Modal */}
                {showCreateForm && (
                    <div className="modal-overlay" onClick={() => setShowCreateForm(false)}>
                        <div className="modal" onClick={(e) => e.stopPropagation()}>
                            <CreateToggleForm
                                onSubmit={handleCreate}
                                onCancel={() => setShowCreateForm(false)}
                            />
                        </div>
                    </div>
                )}

                {/* Audit Log Panel */}
                {showAuditLog && (
                    <AuditLog entries={auditLog} />
                )}

                {/* Loading State */}
                {loading && (
                    <div className="loading">
                        <div className="loading-spinner" />
                        <span>Loading toggles...</span>
                    </div>
                )}

                {/* Error State */}
                {error && (
                    <div className="error">
                        <h3>⚠️ Error</h3>
                        <p>{error}</p>
                        <button onClick={() => { setError(null); fetchToggles(); }}>Retry</button>
                    </div>
                )}

                {/* Toggles List */}
                {toggles && (
                    <div className="toggles-container">
                        {filteredToggles.length === 0 ? (
                            <div className="no-results">
                                <p>No toggles found matching your criteria</p>
                            </div>
                        ) : (
                            filteredToggles.map(([name, toggle]) => (
                                <ToggleCard
                                    key={name}
                                    name={name}
                                    toggle={toggle}
                                    onToggle={handleToggle}
                                    onDelete={handleDelete}
                                    isUpdating={updatingToggle === name}
                                />
                            ))
                        )}
                    </div>
                )}
            </main>

            <footer className="footer">
                <p>Feature Context Toggle v1.0.0 • ConFuse Dev Tools</p>
                <p>This is a private developer tool - not for end users</p>
            </footer>
        </div>
    );
}

export default App;
