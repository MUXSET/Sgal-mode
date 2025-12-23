/**
 * PlaylistEngine.js
 * Parses DOM message elements into dialogue frames
 * Pure functions with no side effects
 */

export class PlaylistEngine {
    /**
     * Flatten DOM tree into text/image/linebreak tokens
     */
    flattenDom(node, list = []) {
        const nodeFilter = {
            acceptNode: function (node) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    const tagName = node.nodeName;
                    const classList = node.classList || [];
                    if (['SCRIPT', 'STYLE', 'TAG_THINK', 'THINKING', 'DETAILS', 'SELECT', 'SUMMARY'].includes(tagName)) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    if (classList.contains('suggestion_box') ||
                        classList.contains('thinking') ||
                        classList.contains('cot') ||
                        classList.contains('reasoning') ||
                        classList.contains('inline-dropdown') ||
                        classList.contains('mes_button')) {
                        return NodeFilter.FILTER_REJECT;
                    }
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        };

        const walker = document.createTreeWalker(
            node,
            NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
            nodeFilter
        );

        let currentNode = walker.currentNode;

        while (currentNode) {
            if (currentNode.nodeType === Node.ELEMENT_NODE && currentNode.nodeName === 'IMG') {
                if (!currentNode.classList.contains('emoji') &&
                    !currentNode.classList.contains('icon') &&
                    !currentNode.classList.contains('avatar_img') &&
                    currentNode.src) {
                    list.push({ type: 'IMG', val: currentNode.src });
                }
            }
            else if (currentNode.nodeType === Node.ELEMENT_NODE &&
                (currentNode.nodeName === 'BR' || currentNode.nodeName === 'HR')) {
                list.push({ type: 'BR' });
            }
            else if (currentNode.nodeType === Node.ELEMENT_NODE &&
                ['P', 'DIV', 'BLOCKQUOTE'].includes(currentNode.nodeName)) {
                const lastItem = list[list.length - 1];
                if (!lastItem || lastItem.type !== 'BR') {
                    list.push({ type: 'BR' });
                }
            }
            else if (currentNode.nodeType === Node.TEXT_NODE) {
                const txt = currentNode.textContent;
                if (txt && txt.replace(/[\n\s]/g, '').length > 0) {
                    list.push({ type: 'TEXT', val: txt });
                }
            }
            currentNode = walker.nextNode();
        }
        return list;
    }

    /**
     * Clean text from system artifacts
     */
    cleanText(text) {
        if (!text) return "";
        return text
            .replace(/image###[\s\S]*?###/gi, '')
            .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
            .replace(/<\/?(image|FILE_CONTENT|ATTACHMENT_FILE)[^>]*>/gi, '')
            .trim();
    }

    /**
     * Parse character name from text (if present)
     */
    parseCharacterName(text) {
        const patterns = [
            /^([^:：\n]+?)[：:][\s]*["「『]/,
            /^([^:：\n]+?)[：:][\s]*\*/,
            /^([^:：\n]+?)[：:][\s]*\(/,
            /^([^:：\n]+?)[：:][\s]*[^"「『\*\(]/
        ];
        for (const pattern of patterns) {
            const match = text.trim().match(pattern);
            if (match && match[1]) {
                const name = match[1].trim();
                if (name.length > 0 && name.length <= 20 && !/[<>{}]/.test(name)) {
                    return name;
                }
            }
        }
        return null;
    }

    /**
     * Remove character name prefix from text
     */
    removeNamePrefix(text) {
        let cleaned = text;
        const patterns = [/^[^:：\n]+?[：:][\s]*/];
        for (const pattern of patterns) {
            if (pattern.test(text.trim())) {
                cleaned = text.replace(pattern, '').trim();
                break;
            }
        }
        if (cleaned.startsWith('"') && cleaned.endsWith('"') && (cleaned.includes('「') || cleaned.includes('『'))) {
            cleaned = cleaned.substring(1, cleaned.length - 1).trim();
        }
        return cleaned;
    }

    /**
     * Build playlist from message element
     * @param {HTMLElement} msgElement - The message DOM element
     * @param {string} initialBg - Initial background image URL
     * @param {number} messageIndex - Index of this message in chat
     * @returns {Array} Array of dialogue frames
     */
    buildPlaylist(msgElement, initialBg, messageIndex = 0) {
        const textContainer = msgElement.querySelector('.mes_text');
        if (!textContainer) return [];

        let rawList = this.flattenDom(textContainer);
        const output = [];

        let defaultBg = null;
        const attachments = msgElement.querySelectorAll('.mes_file_container img');
        if (attachments.length > 0) defaultBg = attachments[0].src;

        if (!defaultBg) {
            for (let i = 0; i < rawList.length; i++) {
                if (rawList[i].type === 'IMG') {
                    defaultBg = rawList[i].val;
                    break;
                }
            }
        }

        let currentBg = defaultBg || initialBg;
        let buffer = "";
        const defaultName = msgElement.querySelector('.name_text')?.innerText || "System";
        const isUser = msgElement.getAttribute('is_user') === 'true';

        for (let i = 0; i < rawList.length; i++) {
            const item = rawList[i];
            if (item.type === 'TEXT') {
                buffer += item.val;
            }
            else if (item.type === 'IMG') {
                if (this.cleanText(buffer).length > 0) {
                    const parsedName = this.parseCharacterName(buffer);
                    const finalName = parsedName !== null ? parsedName : (isUser ? defaultName : "");
                    const cleanedText = parsedName !== null ? this.removeNamePrefix(buffer) : buffer;
                    output.push({
                        text: this.cleanText(cleanedText),
                        img: currentBg,
                        name: finalName,
                        isUser
                    });
                    buffer = "";
                }
                currentBg = item.val;
            }
            else if (item.type === 'BR') {
                if (this.cleanText(buffer).length > 0) {
                    const parsedName = this.parseCharacterName(buffer);
                    const finalName = parsedName !== null ? parsedName : (isUser ? defaultName : "");
                    const cleanedText = parsedName !== null ? this.removeNamePrefix(buffer) : buffer;
                    output.push({
                        text: this.cleanText(cleanedText),
                        img: currentBg,
                        name: finalName,
                        isUser
                    });
                    buffer = "";
                }
            }
        }

        if (this.cleanText(buffer).length > 0) {
            const parsedName = this.parseCharacterName(buffer) || defaultName;
            const cleanedText = parsedName !== defaultName ? this.removeNamePrefix(buffer) : buffer;
            output.push({
                text: this.cleanText(cleanedText),
                img: currentBg,
                name: parsedName,
                isUser
            });
        }

        if (output.length > 0 && output.some(x => !x.img)) {
            output.forEach(x => { if (!x.img) x.img = currentBg; });
        }

        return output;
    }
}
