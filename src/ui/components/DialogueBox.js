/**
 * DialogueBox.js
 * Renders dialogue frames (name, text, background)
 */

export class DialogueBox {
    constructor(stateManager, typewriterEngine, imageService) {
        this.state = stateManager;
        this.typewriter = typewriterEngine;
        this.imageService = imageService;
        this.$dialogueBox = null;
        this.$nameTag = null;
        this.$textContent = null;
        this.$nextIndicator = null;
        this.$bgLayer = null;
        this.$bgBlur = null;
        this.$progress = null;
    }

    /**
     * Initialize DOM references
     */
    initialize() {
        this.$dialogueBox = $('#gal-dialogue-box');
        this.$nameTag = $('#gal-name-tag');
        this.$textContent = $('#gal-text-content');
        this.$nextIndicator = $('#gal-next-indicator');
        this.$bgLayer = $('#gal-bg-layer');
        this.$bgBlur = $('#gal-bg-blur');
        this.$progress = $('#gal-progress');
    }

    /**
     * Render a dialogue frame
     * @param {Object} frame - Frame object {text, img, name, isUser}
     * @param {boolean} skipTypewriter - Skip animation and show immediately
     */
    renderFrame(frame, skipTypewriter = false) {
        if (!frame) return;

        // Stop any ongoing animation
        this.typewriter.stop();

        // Update name tag
        this.setNameTag(frame.name, frame.isUser);

        // Update background
        if (frame.img) {
            this.updateBackground(frame.img);
        }

        // Update text (with or without typewriter)
        this.setText(frame.text, !skipTypewriter);

        // Update progress indicator
        this.updateProgressIndicator();
    }

    /**
     * Set name tag
     */
    setNameTag(name, isUser) {
        if (name) {
            const color = this.state.getCharacterColor(name, isUser);
            this.$nameTag.text(name).css('color', color).show();
        } else {
            this.$nameTag.hide();
        }
    }

    /**
     * Update background image
     */
    updateBackground(imageUrl) {
        const targetUrl = `url("${imageUrl}")`;
        const currentUrl = this.$bgLayer.css('background-image');

        // Only update if different (avoid flicker)
        if (!currentUrl || (!currentUrl.includes(encodeURI(imageUrl)) && !currentUrl.includes(imageUrl))) {
            this.$bgLayer.css('background-image', targetUrl);
            this.$bgBlur.css('background-image', targetUrl);
        }
    }

    /**
     * Set text content with optional typewriter
     */
    setText(text, useTypewriter) {
        this.$nextIndicator.removeClass('visible');

        const onComplete = () => {
            // Show next indicator if not at end
            if (this.state.playIndex < this.state.playList.length - 1) {
                this.$nextIndicator.addClass('visible');
            }
        };

        if (useTypewriter && this.state.typewriterEnabled) {
            this.typewriter.start(text, this.$textContent, onComplete);
        } else {
            this.$textContent.html(text.replace(/\n/g, '<br>'));
            onComplete();
        }
    }

    /**
     * Update progress indicator
     */
    updateProgressIndicator() {
        const current = this.state.playIndex + 1;
        const total = this.state.playList.length;
        this.$progress.text(`${current}/${total}`);
    }

    /**
     * Update text during streaming (without full re-render)
     */
    updateTextOnly(text) {
        if (!this.typewriter.isAnimating()) {
            this.$textContent.html(text.replace(/\n/g, '<br>'));
        }
    }
}
