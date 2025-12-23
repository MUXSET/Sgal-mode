/**
 * SettingsMenu.js
 * Handles settings modal (typewriter, font size)
 */

export class SettingsMenu {
    constructor(stateManager) {
        this.state = stateManager;
        this.$menu = null;
        this.$typewriterToggle = null;
        this.$typewriterSpeed = null;
        this.$fontSlider = null;
        this.$speedValue = null;
    }

    /**
     * Initialize settings menu
     */
    initialize() {
        this.$menu = $('#gal-settings-menu');
        this.$typewriterToggle = $('#gal-typewriter-toggle');
        this.$typewriterSpeed = $('#gal-typewriter-speed');
        this.$fontSlider = $('#gal-font-slider');
        this.$speedValue = $('#gal-speed-value');

        this.bindEvents();
        this.loadSettings();
    }

    /**
     * Bind event handlers
     */
    bindEvents() {
        // Typewriter toggle
        this.$typewriterToggle.off('change').on('change', (e) => {
            e.stopPropagation();
            this.state.typewriterEnabled = $(e.target).is(':checked');
        });

        // Typewriter speed slider
        this.$typewriterSpeed.off('input').on('input', (e) => {
            e.stopPropagation();
            const speed = parseInt($(e.target).val());
            this.state.typewriterSpeed = speed;
            this.$speedValue.text(speed);
        });

        // Font size slider
        this.$fontSlider.off('input').on('input', (e) => {
            e.stopPropagation();
            const fontSize = $(e.target).val();
            this.state.currentFontSize = fontSize;
            $('#gal-text-content').css('font-size', fontSize + 'px');
        });
    }

    /**
     * Load settings from state
     */
    loadSettings() {
        this.$typewriterToggle.prop('checked', this.state.typewriterEnabled);
        this.$typewriterSpeed.val(this.state.typewriterSpeed);
        this.$speedValue.text(this.state.typewriterSpeed);
        this.$fontSlider.val(this.state.currentFontSize);
    }

    /**
     * Show settings menu
     */
    show() {
        $('.gal-modal').removeClass('active');
        this.$menu.addClass('active');
    }

    /**
     * Hide settings menu
     */
    hide() {
        this.$menu.removeClass('active');
    }

    /**
     * Toggle visibility
     */
    toggle() {
        this.$menu.toggleClass('active');
    }

    /**
     * Get current settings
     */
    getSettings() {
        return {
            typewriterEnabled: this.state.typewriterEnabled,
            typewriterSpeed: this.state.typewriterSpeed,
            fontSize: this.state.currentFontSize
        };
    }
}
