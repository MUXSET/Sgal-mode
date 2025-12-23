/**
 * ChoiceSystem.js
 * Renders interactive choices and continue button
 */

export class ChoiceSystem {
    constructor() {
        this.$choiceContainer = null;
        this.$choiceList = null;
        this.$continueContainer = null;
        this.$continueBtn = null;
    }

    /**
     * Initialize choice system
     */
    initialize() {
        this.$choiceContainer = $('#gal-choice-container');
        this.$choiceList = $('#gal-choice-list');
        this.$continueContainer = $('#gal-continue-container');
        this.$continueBtn = $('#gal-continue-btn');
    }

    /**
     * Render choices
     * @param {Array} choices - Array of {id, text}
     * @param {Function} onSelect - Callback when choice is selected
     */
    renderChoices(choices, onSelect) {
        if (!choices || choices.length === 0) return;

        this.$choiceList.empty();

        choices.forEach((choice) => {
            const $btn = $(`
                <div class="gal-choice-btn" data-choice-id="${choice.id}">
                    ${choice.id}. ${choice.text}
                </div>
            `);

            $btn.on('click', function () {
                onSelect(choice);
            });

            this.$choiceList.append($btn);
        });

        this.$choiceContainer.fadeIn(300);
    }

    /**
     * Hide choices
     */
    hideChoices() {
        this.$choiceContainer.fadeOut(300);
    }

    /**
     * Mark choice as selected (visual feedback)
     */
    markChoiceSelected(choiceId) {
        $(`.gal-choice-btn[data-choice-id="${choiceId}"]`).addClass('selected');
        $('.gal-choice-btn').prop('disabled', true).css('pointer-events', 'none');
    }

    /**
     * Reset choices (enable all)
     */
    resetChoices() {
        $('.gal-choice-btn').removeClass('selected').prop('disabled', false).css('pointer-events', 'auto');
    }

    /**
     * Show continue button
     * @param {Function} onClick - Callback when clicked
     */
    showContinueButton(onClick) {
        this.$continueBtn.off('click').on('click', async (e) => {
            e.stopPropagation();
            if (onClick) await onClick();
        });

        this.$continueContainer.fadeIn(300);
    }

    /**
     * Hide continue button
     */
    hideContinueButton() {
        this.$continueContainer.fadeOut(300);
    }
}
