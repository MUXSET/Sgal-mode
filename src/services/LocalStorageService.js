/**
 * LocalStorageService.js
 * Handles localStorage operations for quick saves and auto-progress
 */

export class LocalStorageService {
    constructor(stateManager) {
        this.state = stateManager;
    }

    /**
     * Auto-save current playback progress
     * @param {string} charName - Character name
     * @param {number} playIndex - Current play index
     */
    saveAutoProgress(charName, playIndex) {
        try {
            const key = this.state.AUTO_SAVE_KEY_PREFIX + charName;
            localStorage.setItem(key, playIndex.toString());
        } catch (error) {
            console.error('[LocalStorageService] Failed to save auto progress:', error);
        }
    }

    /**
     * Load auto-saved progress
     * @param {string} charName - Character name
     * @returns {number|null} Saved playIndex or null
     */
    loadAutoProgress(charName) {
        try {
            const key = this.state.AUTO_SAVE_KEY_PREFIX + charName;
            const savedIndex = localStorage.getItem(key);
            return savedIndex !== null ? parseInt(savedIndex, 10) : null;
        } catch (error) {
            console.error('[LocalStorageService] Failed to load auto progress:', error);
            return null;
        }
    }

    /**
     * Save to quick save slot (old localStorage system)
     * @param {string} charName - Character name
     * @param {number} slotId - Slot number (1-5)
     * @param {Object} saveData - Data to save {index, text, time}
     */
    saveQuickSave(charName, slotId, saveData) {
        try {
            const key = this.state.SAVE_KEY_PREFIX + charName + '_' + slotId;
            localStorage.setItem(key, JSON.stringify(saveData));
            console.log(`[LocalStorageService] Quick saved to slot ${slotId}`);
        } catch (error) {
            console.error('[LocalStorageService] Failed to save quick save:', error);
        }
    }

    /**
     * Load from quick save slot
     * @param {string} charName - Character name
     * @param {number} slotId - Slot number (1-5)
     * @returns {Object|null} Save data or null
     */
    loadQuickSave(charName, slotId) {
        try {
            const key = this.state.SAVE_KEY_PREFIX + charName + '_' + slotId;
            const raw = localStorage.getItem(key);
            if (raw) {
                return JSON.parse(raw);
            }
            return null;
        } catch (error) {
            console.error('[LocalStorageService] Failed to load quick save:', error);
            return null;
        }
    }

    /**
     * List all quick save slots for character
     * @param {string} charName - Character name
     * @returns {Array} Array of slot info {slotId, data}
     */
    listQuickSaves(charName) {
        const saves = [];
        for (let i = 1; i <= 5; i++) {
            const data = this.loadQuickSave(charName, i);
            saves.push({
                slotId: i,
                data: data,
                isEmpty: !data
            });
        }
        return saves;
    }

    /**
     * Delete quick save
     * @param {string} charName - Character name
     * @param {number} slotId - Slot number
     */
    deleteQuickSave(charName, slotId) {
        try {
            const key = this.state.SAVE_KEY_PREFIX + charName + '_' + slotId;
            localStorage.removeItem(key);
        } catch (error) {
            console.error('[LocalStorageService] Failed to delete quick save:', error);
        }
    }
}
