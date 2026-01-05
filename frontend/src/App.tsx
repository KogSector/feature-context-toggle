import { useState, useEffect, useCallback } from 'react';

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
    demoUser?: DemoUser;
}

interface ToggleState {
    [key: string]: FeatureToggle;
}

interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    timestamp: string;
}

/**
 * Icon mapping for toggle categories
 */
const categoryIcons: Record<string, string> = {
    authentication: '🔐',
    debugging: '🐛',
    performance: '⚡',
    default: '🎛️',
};

/**
 * Format toggle name for display
 */
function formatToggleName(name: string): string {
    // Convert camelCase to Title Case with spaces
    return name
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .trim();
}

/**
 * Toggle Card Component
 */
function ToggleCard({
    name,
    toggle,
    onToggle,
    isUpdating
}: {
    name: string;
    toggle: FeatureToggle;
    onToggle: (name: string, enabled: boolean) => void;
    isUpdating: boolean;
}) {
    const icon = categoryIcons[toggle.category] || categoryIcons.default;

    return (
        <div className={`toggle-card ${toggle.enabled ? 'enabled' : ''}`}>
            <div className="toggle-card-content">
                <div className="toggle-info">
                    <div className="toggle-header">
                        <span className="toggle-icon">{icon}</span>
                        <span className="toggle-name">{formatToggleName(name)}</span>
                    </div>
                    <p className="toggle-description">{toggle.description}</p>
                    <span className="toggle-category">
                        📁 {toggle.category}
                    </span>
                    <div className={`toggle-status ${toggle.enabled ? 'enabled' : 'disabled'}`}>
                        <span className="status-dot" />
                        {toggle.enabled ? 'Enabled' : 'Disabled'}
                    </div>
                </div>

                <label className="toggle-switch">
                    <input
                        type="checkbox"
                        checked={toggle.enabled}
                        onChange={(e) => onToggle(name, e.target.checked)}
                        disabled={isUpdating}
                    />
                    <span className="toggle-slider" />
                </label>
            </div>

            {/* Show demo user info when auth bypass is enabled */}
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
 * Main App Component
 */
function App() {
    const [toggles, setToggles] = useState<ToggleState | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [updatingToggle, setUpdatingToggle] = useState<string | null>(null);

    /**
     * Fetch all toggles from API
     */
    const fetchToggles = useCallback(async () => {
        try {
            setError(null);
            const response = await fetch('/api/toggles');
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
     * Update a toggle's enabled state
     */
    const handleToggle = async (name: string, enabled: boolean) => {
        setUpdatingToggle(name);

        try {
            const response = await fetch(`/api/toggles/${name}`, {
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
            } else {
                throw new Error(data.error || 'Failed to update toggle');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
            // Revert optimistic update by refetching
            fetchToggles();
        } finally {
            setUpdatingToggle(null);
        }
    };

    // Fetch toggles on mount
    useEffect(() => {
        fetchToggles();
    }, [fetchToggles]);

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

            <main>
                {loading && (
                    <div className="loading">
                        <div className="loading-spinner" />
                        <span>Loading toggles...</span>
                    </div>
                )}

                {error && (
                    <div className="error">
                        <h3>⚠️ Error</h3>
                        <p>{error}</p>
                        <button onClick={fetchToggles}>Retry</button>
                    </div>
                )}

                {toggles && (
                    <div className="toggles-container">
                        {Object.entries(toggles).map(([name, toggle]) => (
                            <ToggleCard
                                key={name}
                                name={name}
                                toggle={toggle}
                                onToggle={handleToggle}
                                isUpdating={updatingToggle === name}
                            />
                        ))}
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
