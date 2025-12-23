/**
 * TitleScreen.js
 * Title screen with cartridge (character) selection
 */

export class TitleScreen {
    constructor(stAdapter, characterManager, imageService) {
        this.adapter = stAdapter;
        this.characterManager = characterManager;
        this.imageService = imageService;

        this.$titleScreen = null;
        this.handlers = {};
    }

    /**
     * Render title screen
     */
    render() {
        const charName = this.adapter.getCurrentCharacterName();
        const displayTitle = charName.replace(/_/g, ' ') + "'s Story";
        const avatarUrl = this.imageService.getCharacterAvatar();

        // Update background
        if (avatarUrl) {
            $('#gal-bg-layer').css('background-image', `url("${avatarUrl}")`);
            $('#gal-bg-blur').css('background-image', `url("${avatarUrl}")`);
        }

        const currentCartridgeHtml = avatarUrl ? `
            <div class="gal-current-cartridge">
                <div class="gal-cartridge-avatar" style="background-image: url('${avatarUrl}')"></div>
                <div class="gal-cartridge-label">📼 ${charName.replace(/_/g, ' ')}</div>
            </div>
        ` : '';

        const titleHtml = `
            <div id="gal-title-screen" class="active">
                <div id="gal-game-title">${displayTitle}</div>
                ${currentCartridgeHtml}
                <div class="gal-title-menu">
                    <div class="gal-title-btn" id="gal-btn-newgame">New Game</div>
                    <div class="gal-title-btn" id="gal-btn-continue">Continue</div>
                    <div class="gal-title-btn" id="gal-btn-load">Load Game</div>
                    <div class="gal-title-btn" id="gal-btn-exit">Exit</div>
                </div>
            </div>
        `;

        $('#gal-title-screen').remove();
        $('#gal-overlay').append(titleHtml);
        $('body').addClass('gal-title-active');

        this.bindEvents();
    }

    /**
     * Bind event handlers
     */
    bindEvents() {
        $('#gal-btn-newgame').off('click').on('click', (e) => {
            e.stopPropagation();
            if (this.handlers.onNewGame) this.handlers.onNewGame();
        });

        $('#gal-btn-continue').off('click').on('click', (e) => {
            e.stopPropagation();
            if (this.handlers.onContinue) this.handlers.onContinue();
        });

        $('#gal-btn-load').off('click').on('click', (e) => {
            e.stopPropagation();
            if (this.handlers.onLoad) this.handlers.onLoad();
        });

        $('#gal-btn-exit').off('click').on('click', (e) => {
            e.stopPropagation();
            if (this.handlers.onExit) this.handlers.onExit();
        });
    }

    /**
     * Set event handlers
     */
    setHandlers(handlers) {
        this.handlers = handlers;
    }

    /**
     * Show title screen
     */
    show() {
        this.render();
    }

    /**
     * Hide title screen (with animation)
     */
    hide() {
        $('#gal-title-screen').removeClass('active');
        setTimeout(() => {
            $('#gal-title-screen').remove();
            $('body').removeClass('gal-title-active');
        }, 500);
    }

    /**
     * Render character selector (Deprecated/Hidden but kept for compatibility if needed)
     */
    renderCharacterSelector(onSelect) {
        // Feature removed from UI but method kept to prevent errors if called
        console.warn('Character selector is disabled in this version.');
    }
}
