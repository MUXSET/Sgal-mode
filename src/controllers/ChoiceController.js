/**
 * ChoiceController.js
 * Handles choice detection and user selection
 */

export class ChoiceController {
    constructor(stAdapter, choiceSystem) {
        this.adapter = stAdapter;
        this.choiceSystem = choiceSystem;
    }

    /**
     * Detect choices from text
     * @param {string} text - Text to parse
     * @returns {Array} Array of {id, text} choices
     */
    detectChoices(text) {
        if (!text || typeof text !== 'string') return [];

        let choices = [];

        // Pattern 1: Japanese quote brackets 「choice」
        const quotePattern = /「([^」]+)」/g;
        let match;
        while ((match = quotePattern.exec(text)) !== null) {
            const choiceText = match[1].trim();
            if (choiceText.length > 0) {
                choices.push({ id: choices.length + 1, text: choiceText });
            }
        }
        if (choices.length > 1) return choices;

        // Pattern 2: Square brackets [choice]
        choices = [];
        const bracketPattern = /\[([^\]]+)\]/g;
        while ((match = bracketPattern.exec(text)) !== null) {
            const choiceText = match[1].trim();
            // Exclude image tags
            if (choiceText.length > 0 &&
                !choiceText.startsWith('Img') &&
                !choiceText.startsWith('img') &&
                !choiceText.startsWith('Image')) {
                choices.push({ id: choices.length + 1, text: choiceText });
            }
        }
        if (choices.length > 1) return choices;

        // Pattern 3: Numbered list (1. choice)
        choices = [];
        const lines = text.split('\n');
        const numberPattern = /^(\d+)[.。)）]\s*(.+)$/;
        lines.forEach(line => {
            const lineMatch = line.trim().match(numberPattern);
            if (lineMatch) {
                const num = parseInt(lineMatch[1]);
                const choiceText = lineMatch[2].trim();
                if (choiceText.length > 0) {
                    choices.push({ id: num, text: choiceText });
                }
            }
        });

        if (choices.length > 1) return choices;
        return [];
    }

    /**
     * Handle choice selection (send as message)
     * @param {Object} choice - {id, text}
     * @param {Function} onSuccess - Callback after message sent
     */
    async selectChoice(choice, onSuccess) {
        try {
            console.log('[ChoiceController] Choice selected:', choice);

            // Visual feedback
            this.choiceSystem.markChoiceSelected(choice.id);

            // Show loading indicator
            $('#gal-loading-overlay').fadeIn(200);

            // Wait briefly for visual feedback
            await new Promise(resolve => setTimeout(resolve, 300));

            // Send choice as message
            await this.adapter.sendMessage(choice.text);

            // Wait for system to react
            await new Promise(resolve => setTimeout(resolve, 200));

            if (onSuccess) onSuccess();

        } catch (error) {
            console.error('[ChoiceController] Error selecting choice:', error);
            $('#gal-loading-overlay').fadeOut(200);
            alert('Failed to send choice: ' + error.message);
            this.choiceSystem.resetChoices();
        }
    }

    /**
     * Check if current frame has choices and render them
     * @param {Object} frame - Current dialogue frame
     * @param {Function} onSelect - Callback when choice selected
     */
    checkAndRenderChoices(frame, onSelect) {
        const choices = this.detectChoices(frame.text);
        if (choices.length > 0) {
            setTimeout(() => {
                this.choiceSystem.renderChoices(choices, onSelect);
            }, 500);
            return true;
        }
        return false;
    }
}
