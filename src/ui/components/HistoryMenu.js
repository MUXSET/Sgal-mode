/**
 * HistoryMenu.js
 * Displays history of dialogue with jump navigation
 */

export class HistoryMenu {
    constructor(stateManager) {
        this.state = stateManager;
        this.$menu = null;
        this.$content = null;
        this.$closeBtn = null;
    }

    /**
     * Initialize history menu
     */
    initialize() {
        this.$menu = $('#gal-history-menu');
        this.$content = $('#gal-history-content');
        this.$closeBtn = $('#gal-history-close');

        this.$closeBtn.off('click').on('click', () => {
            this.hide();
        });
    }

    /**
     * Render history list
     * @param {Function} onJump - Callback when user clicks a history item (index)
     */
    renderHistory(onJump) {
        this.$content.empty();

        if (!this.state.playList || this.state.playList.length === 0) {
            this.$content.html('<div style="text-align:center; color:#888; padding:40px;">No history available.</div>');
            return;
        }

        for (let i = 0; i <= this.state.maxPlayIndex; i++) {
            const frame = this.state.playList[i];
            const color = this.state.getCharacterColor(frame.name, frame.isUser);
            const isCurrent = i === this.state.playIndex;

            const $historyItem = $(`
                <div class="gal-history-item" data-index="${i}" id="history-item-${i}" style="
                    display: flex; gap: 15px; padding: 8px 12px; margin-bottom: 2px;
                    background: ${isCurrent ? 'rgba(255,255,255,0.08)' : 'transparent'};
                    border-left: ${isCurrent ? '2px solid ' + color : '2px solid transparent'};
                    cursor: pointer; transition: background 0.15s ease;">
                    <div style="min-width: 80px; max-width: 120px; color: ${color}; font-size: 13px; 
                        font-weight: ${isCurrent ? 'bold' : 'normal'}; 
                        opacity: ${isCurrent ? '1' : '0.85'}; text-align: right; padding-right: 10px; 
                        border-right: 1px solid rgba(255,255,255,0.1); flex-shrink: 0;">
                        ${frame.name}
                    </div>
                    <div style="flex: 1; color: ${isCurrent ? '#fff' : 'rgba(255,255,255,0.75)'}; 
                        font-size: 14px; line-height: 1.6; opacity: ${isCurrent ? '1' : '0.85'};">
                        ${frame.text}
                    </div>
                </div>
            `);

            $historyItem.on('click', (e) => {
                e.stopPropagation();
                if (onJump) onJump(i);
                this.hide();
            });

            $historyItem.on('mouseenter', function () {
                $(this).css('background', 'rgba(255,255,255,0.06)');
            }).on('mouseleave', function () {
                $(this).css('background', isCurrent ? 'rgba(255,255,255,0.08)' : 'transparent');
            });

            this.$content.append($historyItem);
        }

        // Scroll to current item
        setTimeout(() => {
            const currentItem = document.getElementById(`history-item-${this.state.playIndex}`);
            if (currentItem) {
                currentItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 100);
    }

    /**
     * Show history menu
     */
    show(onJump) {
        $('.gal-modal').removeClass('active');
        this.renderHistory(onJump);
        this.$menu.addClass('active');
    }

    /**
     * Hide history menu
     */
    hide() {
        this.$menu.removeClass('active');
    }
}
