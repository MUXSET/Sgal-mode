/**
 * NavigationController.js
 * Handles playback navigation (next, prev, jump)
 */

export class NavigationController {
    constructor(stateManager, dialogueBox) {
        this.state = stateManager;
        this.dialogueBox = dialogueBox;
    }

    /**
     * Go to next frame
     */
    next() {
        if (this.state.playIndex < this.state.playList.length - 1) {
            this.state.playIndex++;
            this.renderCurrent();
        }
    }

    /**
     * Go to previous frame
     */
    prev() {
        if (this.state.playIndex > 0) {
            this.state.playIndex--;
            this.renderCurrent();
        }
    }

    /**
     * Jump to specific index
     * @param {number} index - Target index
     */
    jumpTo(index) {
        if (index >= 0 && index < this.state.playList.length) {
            this.state.playIndex = index;
            this.renderCurrent();
        }
    }

    /**
     * Restart from beginning
     */
    restart() {
        this.state.playIndex = 0;

        // Reset background to character avatar
        if (this.state.characterAvatarUrl) {
            $('#gal-bg-layer').css('background-image', `url("${this.state.characterAvatarUrl}")`);
            $('#gal-bg-blur').css('background-image', `url("${this.state.characterAvatarUrl}")`);
        }

        this.renderCurrent();
    }

    /**
     * Render current frame
     */
    renderCurrent() {
        if (this.state.playList.length === 0) return;

        const frame = this.state.playList[this.state.playIndex];
        this.dialogueBox.renderFrame(frame, false);

        // Update max index if we've gone further
        if (this.state.playIndex > this.state.maxPlayIndex) {
            this.state.maxPlayIndex = this.state.playIndex;
        }
    }

    /**
     * Skip typewriter and go to next (or skip animation)
     * @returns {boolean} True if action was taken
     */
    nextOrSkip(typewriterEngine) {
        // If currently typing, skip to end
        if (typewriterEngine.skip()) {
            this.dialogueBox.setText(typewriterEngine.getCurrentText(), false);
            return true;
        }

        // Otherwise go to next
        if (this.state.playIndex < this.state.playList.length - 1) {
            this.next();
            return true;
        }

        return false;
    }
}
