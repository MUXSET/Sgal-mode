/**
 * STEventHandler.js
 * Handles SillyTavern event system for streaming and message events
 */

export class STEventHandler {
    constructor(stateManager) {
        this.state = stateManager;
        this.tokenHandler = null;
        this.completionHandler = null;
    }

    /**
     * Initialize event system (must be called on startup)
     */
    initialize() {
        try {
            if (window.SillyTavern) {
                if (window.SillyTavern.eventSource) {
                    this.state.eventSource = window.SillyTavern.eventSource;
                }
                if (window.SillyTavern.event_types) {
                    this.state.event_types = window.SillyTavern.event_types;
                }
            }

            if (!this.state.eventSource || !this.state.event_types) {
                console.warn('[STEventHandler] Event system not available');
                return false;
            }

            return true;
        } catch (error) {
            console.error('[STEventHandler] Failed to initialize event system:', error);
            return false;
        }
    }

    /**
     * Setup streaming listeners for a specific message
     * @param {number} messageId - Message ID to track
     * @param {Function} onToken - Callback for each token received
     * @param {Function} onComplete - Callback when message is complete
     * @returns {boolean} True if listeners were setup successfully
     */
    setupStreamingListeners(messageId, onToken, onComplete) {
        if (!this.state.eventSource || !this.state.event_types) {
            console.warn('[STEventHandler] Event system not initialized');
            return false;
        }

        // Remove old listeners if they exist
        this.removeStreamingListeners();

        const eventSource = this.state.eventSource;
        const eventTypes = this.state.event_types;

        // Token received handler
        this.tokenHandler = (data) => {
            if (this.state.pendingGeneration && this.state.streamingMessageId !== null) {
                if (onToken) onToken(data);
            }
        };

        // Message completion handler
        this.completionHandler = (data) => {
            const receivedId = typeof data === 'object' ? data.id : data;
            if (receivedId >= messageId) {
                this.removeStreamingListeners();
                if (onComplete) onComplete(receivedId);
            }
        };

        // Register listeners
        eventSource.on(eventTypes.STREAM_TOKEN_RECEIVED, this.tokenHandler);
        eventSource.on(eventTypes.CHARACTER_MESSAGE_RENDERED, this.completionHandler);

        // Store globally for cleanup
        window._galTokenHandler = this.tokenHandler;
        window._galCompletionHandler = this.completionHandler;

        return true;
    }

    /**
     * Remove streaming listeners
     */
    removeStreamingListeners() {
        if (!this.state.eventSource || !this.state.event_types) return;

        const eventSource = this.state.eventSource;
        const eventTypes = this.state.event_types;

        if (window._galTokenHandler) {
            eventSource.off(eventTypes.STREAM_TOKEN_RECEIVED, window._galTokenHandler);
            window._galTokenHandler = null;
        }

        if (window._galCompletionHandler) {
            eventSource.off(eventTypes.CHARACTER_MESSAGE_RENDERED, window._galCompletionHandler);
            window._galCompletionHandler = null;
        }

        this.tokenHandler = null;
        this.completionHandler = null;
    }

    /**
     * Check if event system is available
     */
    isAvailable() {
        return !!(this.state.eventSource && this.state.event_types);
    }
}
