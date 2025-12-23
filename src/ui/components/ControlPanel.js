/**
 * ControlPanel.js
 * Handles control button interactions
 */

export class ControlPanel {
    constructor() {
        this.handlers = {};
        this.$buttons = {};
    }

    /**
     * Initialize control panel with event handlers
     * @param {Object} handlers - Map of button names to handler functions
     */
    initialize(handlers) {
        this.handlers = handlers;

        // Cache button references
        this.$buttons = {
            close: $('#gal-close-btn'),
            prev: $('#gal-prev-btn'),
            back: $('#gal-back-btn'),
            settings: $('#gal-settings-btn'),
            save: $('#gal-save-btn'),
            load: $('#gal-load-btn'),
            history: $('#gal-history-btn'),
            sync: $('#gal-sync-btn')
        };

        // Bind event handlers
        this.bindEvents();
    }

    /**
     * Bind click events to handlers
     */
    bindEvents() {
        Object.entries(this.$buttons).forEach(([name, $btn]) => {
            if ($btn.length > 0) {
                $btn.off('click').on('click', (e) => {
                    e.stopPropagation();
                    if (this.handlers[name]) {
                        this.handlers[name](e);
                    }
                });
            }
        });
    }

    /**
     * Enable button
     */
    enableButton(btnName) {
        if (this.$buttons[btnName]) {
            this.$buttons[btnName].prop('disabled', false);
        }
    }

    /**
     * Disable button
     */
    disableButton(btnName) {
        if (this.$buttons[btnName]) {
            this.$buttons[btnName].prop('disabled', true);
        }
    }

    /**
     * Show/hide button
     */
    toggleButton(btnName, show) {
        if (this.$buttons[btnName]) {
            this.$buttons[btnName].toggle(show);
        }
    }
}
