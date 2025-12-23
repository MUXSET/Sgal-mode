/**
 * TypewriterEngine.js
 * Handles typewriter text animation effects
 */

export class TypewriterEngine {
    constructor(stateManager) {
        this.state = stateManager;
    }

    /**
     * Start typewriter animation
     * @param {string} text - Text to animate
     * @param {jQuery} element - Target element
     * @param {Function} onComplete - Callback when animation completes
     */
    start(text, element, onComplete = null) {
        this.stop(); // Clear any existing animation

        if (!this.state.typewriterEnabled) {
            element.html(text.replace(/\n/g, '<br>'));
            if (onComplete) onComplete();
            return;
        }

        this.state.isTyping = true;
        this.state.currentTypingText = text;

        let charIndex = 0;
        const textLength = text.length;

        // Display first character immediately
        element.html(text.charAt(0).replace(/\n/g, '<br>'));
        charIndex = 1;

        this.state.typewriterTimer = setInterval(() => {
            if (charIndex < textLength) {
                const displayText = text.substring(0, charIndex + 1);
                element.html(displayText.replace(/\n/g, '<br>'));
                charIndex++;
            } else {
                this.stop();
                element.html(text.replace(/\n/g, '<br>'));
                if (onComplete) onComplete();
            }
        }, this.state.typewriterSpeed);
    }

    /**
     * Stop current typewriter animation
     */
    stop() {
        if (this.state.typewriterTimer) {
            clearInterval(this.state.typewriterTimer);
            this.state.typewriterTimer = null;
        }
        this.state.isTyping = false;
    }

    /**
     * Skip to end of animation (display full text immediately)
     * @returns {boolean} True if animation was skipped, false if not animating
     */
    skip() {
        if (this.state.isTyping && this.state.typewriterTimer) {
            this.stop();
            return true;
        }
        return false;
    }

    /**
     * Check if currently animating
     */
    isAnimating() {
        return this.state.isTyping;
    }

    /**
     * Get current typing text
     */
    getCurrentText() {
        return this.state.currentTypingText;
    }
}
