/**
 * STCharacterManager.js
 * Manages character list and switching functionality
 */

export class STCharacterManager {
    constructor(stAdapter) {
        this.adapter = stAdapter;
    }

    /**
     * Get list of all characters with fallback
     * @returns {Array} Array of {id, name, avatar}
     */
    getCharacterList() {
        try {
            const ctx = this.adapter.getContext();
            if (!ctx) return this.getCharacterListFallback();

            const characters = ctx.characters || [];
            return characters.map((char, index) => ({
                id: index,
                name: char.name,
                avatar: this.adapter.getThumbnailUrl(char.avatar)
            }));
        } catch (error) {
            console.error('[STCharacterManager] Error getting character list:', error);
            return this.getCharacterListFallback();
        }
    }

    /**
     * Fallback method to get characters from DOM
     */
    getCharacterListFallback() {
        const characterElements = document.querySelectorAll('.character_select');
        const characters = [];

        characterElements.forEach((el) => {
            const chid = el.getAttribute('data-chid');
            const img = el.querySelector('img');
            const avatar = img?.src || img?.getAttribute('src');
            const name = el.querySelector('.ch_name')?.textContent?.trim() || 'Unknown';

            if (chid !== null && avatar) {
                characters.push({
                    id: parseInt(chid),
                    name: name,
                    avatar: avatar
                });
            }
        });

        return characters;
    }

    /**
     * Get current character ID with fallback
     */
    getCurrentCharacterId() {
        try {
            const id = this.adapter.getCurrentCharacterId();
            if (id !== null) return id;

            // Fallback to DOM
            const selected = document.querySelector('.character_select.selected');
            if (selected) {
                const chid = selected.getAttribute('data-chid');
                return chid !== null ? parseInt(chid) : null;
            }

            return null;
        } catch (error) {
            console.error('[STCharacterManager] Error getting current character ID:', error);
            return null;
        }
    }

    /**
     * Switch to character with loading overlay
     * @param {number} charId - Character ID
     * @param {string} charName - Character name (for display)
     * @returns {Promise<void>}
     */
    async switchToCharacter(charId, charName) {
        // Create loading overlay
        const loadingOverlay = $(`
            <div style="
                position: fixed; 
                top: 0; 
                left: 0; 
                width: 100%; 
                height: 100%; 
                background: rgba(0,0,0,0.9); 
                z-index: 9999999; 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                color: #00d2ff; 
                font-size: 28px;
            ">
                Loading character...
            </div>
        `);

        $('body').append(loadingOverlay);

        try {
            await this.adapter.selectCharacter(charId);

            // Wait for character to load
            await new Promise(resolve => setTimeout(resolve, 2000));

            return true;
        } catch (error) {
            console.error('[STCharacterManager] Error switching character:', error);
            throw error;
        } finally {
            loadingOverlay.remove();
        }
    }
}
