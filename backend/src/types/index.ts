/**
 * Feature Context Toggle - Type Definitions
 */

export interface DemoUser {
    id: string;
    email: string;
    name: string;
    roles: string[];
    sessionId: string;
}

export interface FeatureToggle {
    enabled: boolean;
    description: string;
    category: string;
    demoUser?: DemoUser;
}

export interface ToggleState {
    [key: string]: FeatureToggle;
}

export interface ToggleUpdateRequest {
    enabled: boolean;
}

export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    timestamp: string;
}
