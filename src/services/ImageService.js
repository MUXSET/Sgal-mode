/**
 * ImageService.js
 * Handles background images and avatar URLs
 */

export class ImageService {
    constructor(stAdapter) {
        this.adapter = stAdapter;
    }

    /**
     * Get current character avatar URL
     */
    getCharacterAvatar() {
        return this.adapter.getCurrentCharacterAvatar();
    }

    /**
     * Extract images from message element
     * @param {HTMLElement} msgElement - Message DOM element
     * @returns {Array<string>} Array of image URLs
     */
    extractImagesFromMessage(msgElement) {
        const images = [];

        // Check file attachments
        const attachments = msgElement.querySelectorAll('.mes_file_container img');
        attachments.forEach(img => {
            if (img.src) images.push(img.src);
        });

        // Check inline images
        const inlineImages = msgElement.querySelectorAll('.mes_text img');
        inlineImages.forEach(img => {
            if (img.src &&
                !img.classList.contains('emoji') &&
                !img.classList.contains('icon') &&
                !img.classList.contains('avatar_img')) {
                images.push(img.src);
            }
        });

        return images;
    }

    /**
     * Get first image from message (for background)
     * @param {HTMLElement} msgElement - Message DOM element
     * @returns {string|null} Image URL or null
     */
    getFirstImage(msgElement) {
        const images = this.extractImagesFromMessage(msgElement);
        return images.length > 0 ? images[0] : null;
    }

    /**
     * Build thumbnail URL from avatar field
     * @param {string} avatarField - Avatar field value
     * @returns {string} Thumbnail URL
     */
    getThumbnailUrl(avatarField) {
        return this.adapter.getThumbnailUrl(avatarField);
    }

    /**
     * Preload image (for smoother transitions)
     * @param {string} url - Image URL
     * @returns {Promise<void>}
     */
    preloadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
            img.src = url;
        });
    }
}
