/**
 * StateManager.js
 * Central state store for the Galgame session
 * All mutable state is managed here to maintain single source of truth
 */

export class StateManager {
    constructor() {
        // Playlist state
        this.playList = [];
        this.playIndex = 0;
        this.maxPlayIndex = 0; // Track furthest progress user has seen

        // Save system keys
        this.SAVE_KEY_PREFIX = 'gal_save_';
        this.AUTO_SAVE_KEY_PREFIX = 'gal_autosave_';

        // Character avatar
        this.characterAvatarUrl = null;

        // Typewriter settings
        this.typewriterEnabled = true;
        this.typewriterSpeed = 50; // ms per character
        this.typewriterTimer = null;
        this.isTyping = false;
        this.currentTypingText = '';

        // Interactive mode state
        this.isActiveMode = false;
        this.pendingGeneration = false;
        this.streamingMessageId = null;
        this.streamingStartIndex = 0;
        this.resumePlayIndex = null;

        // UI settings
        this.currentFontSize = 26;

        // Character colors for name tags
        this.characterColors = {};
        this.colorPalette = ['#00d2ff', '#ff6ec7', '#ffd700', '#00ff88', '#ff8c00', '#b19cd9', '#ff6b6b'];
        this.colorIndex = 0;

        // SillyTavern event system references
        this.eventSource = null;
        this.event_types = null;

        // Restore state from load if available
        if (window.GAL_PENDING_LOAD_STATE) {
            const state = window.GAL_PENDING_LOAD_STATE;
            console.log("[StateManager] Restoring pending state:", state);

            // 🌟 恢复 playIndex
            if (state.playIndex !== undefined) {
                this.playIndex = state.playIndex;
                this.maxPlayIndex = Math.max(this.maxPlayIndex, this.playIndex);
            }

            // 🌟 恢复 playList 快照（如果存在）
            if (state.playlistSnapshot && Array.isArray(state.playlistSnapshot) && state.playlistSnapshot.length > 0) {
                console.log(`[StateManager] Restoring playlist snapshot with ${state.playlistSnapshot.length} frames.`);
                this.playList = state.playlistSnapshot;

                // 安全修正：防止索引溢出
                if (this.playIndex >= this.playList.length) {
                    this.playIndex = this.playList.length - 1;
                }

                // 更新最大进度
                this.maxPlayIndex = Math.max(this.maxPlayIndex, this.playList.length - 1);
            } else {
                console.warn("[StateManager] No playlist snapshot found in save data (legacy save or corrupted).");
            }

            // Clean up
            delete window.GAL_PENDING_LOAD_STATE;
        }
    }

    /**
     * Get complete state snapshot
     */
    getState() {
        return {
            playList: this.playList,
            playIndex: this.playIndex,
            maxPlayIndex: this.maxPlayIndex,
            isActiveMode: this.isActiveMode,
            pendingGeneration: this.pendingGeneration,
            typewriterEnabled: this.typewriterEnabled,
            typewriterSpeed: this.typewriterSpeed,
            currentFontSize: this.currentFontSize,
            characterAvatarUrl: this.characterAvatarUrl
        };
    }

    /**
     * Update specific state properties
     */
    updateState(updates) {
        Object.assign(this, updates);
    }

    /**
     * Reset state (for new game/character switch)
     */
    resetState() {
        this.playList = [];
        this.playIndex = 0;
        this.maxPlayIndex = 0;
        this.isActiveMode = false;
        this.pendingGeneration = false;
        this.streamingMessageId = null;
        this.streamingStartIndex = 0;
        this.resumePlayIndex = null;
        this.isTyping = false;
        this.currentTypingText = '';
        if (this.typewriterTimer) {
            clearInterval(this.typewriterTimer);
            this.typewriterTimer = null;
        }
    }

    /**
     * Get character color (assign if not exists)
     */
    getCharacterColor(name, isUser) {
        if (isUser) return '#00d2ff';
        if (!this.characterColors[name]) {
            this.characterColors[name] = this.colorPalette[this.colorIndex % this.colorPalette.length];
            this.colorIndex++;
        }
        return this.characterColors[name];
    }

    /**
     * Initialize SillyTavern event system references
     */
    initEventSystem(eventSource, event_types) {
        this.eventSource = eventSource;
        this.event_types = event_types;
    }
}
