/**
 * GameFlowController.js
 * [Stability V9.7 - New Game Index Fix & Null Check]
 */

export class GameFlowController {
    constructor(stateManager, stAdapter, stEventHandler, playlistEngine, dialogueBox, choiceController, navigationController, choiceSystem, imageService, localStorageService) {
        this.state = stateManager;
        this.adapter = stAdapter;
        this.eventHandler = stEventHandler;
        this.playlistEngine = playlistEngine;
        this.dialogueBox = dialogueBox;
        this.choiceController = choiceController;
        this.navigationController = navigationController;
        this.choiceSystem = choiceSystem;
        this.imageService = imageService;
        this.localStorage = localStorageService;

        window.addEventListener('gal:force-sync-ui', async (e) => {
            await new Promise(r => setTimeout(r, 500));
            const pendingState = window.GAL_PENDING_LOAD_STATE;

            if (pendingState) {
                if (pendingState.playlistSnapshot && pendingState.playlistSnapshot.length > 0) {
                    this.state.playList = pendingState.playlistSnapshot;
                    this.state.playIndex = pendingState.playIndex || 0;
                    this.state.maxPlayIndex = pendingState.maxPlayIndex || pendingState.playIndex || 0;
                } else {
                    this.loadAllMessages();
                    if (pendingState.playIndex !== undefined) {
                        this.state.playIndex = Math.min(pendingState.playIndex, this.state.playList.length - 1);
                        this.state.maxPlayIndex = Math.max(this.state.maxPlayIndex, this.state.playIndex);
                    }
                }
                delete window.GAL_PENDING_LOAD_STATE;
            } else {
                this.loadAllMessages();
            }
            this.renderCurrentFrame();
            if (window.toastr) window.toastr.success("存档已恢复");
        });

        // 监听新游戏就绪事件
        $(document).on('gal:new-game-ready', () => {
            this.loadAllMessages(true); // 强制重置
        });
    }

    /**
     * 加载所有消息
     * @param {boolean} forceReset - 强制重置到 0 (新游戏)
     */
    loadAllMessages(forceReset = false) {
        const msgs = document.querySelectorAll('.mes');
        if (msgs.length === 0) return;

        this.state.playList = [];
        this.state.characterAvatarUrl = this.imageService.getCharacterAvatar();
        let lastHistoryImg = this.state.characterAvatarUrl;

        msgs.forEach((msg, msgIndex) => {
            const msgFrames = this.playlistEngine.buildPlaylist(msg, lastHistoryImg, msgIndex);
            if (msgFrames.length > 0) {
                this.state.playList = this.state.playList.concat(msgFrames);
                lastHistoryImg = msgFrames[msgFrames.length - 1].img;
            } else {
                const firstImg = this.imageService.getFirstImage(msg);
                if (firstImg) lastHistoryImg = firstImg;
            }
        });

        if (this.state.playList.length === 0) {
            this.state.playList = [{
                text: "...",
                img: this.state.characterAvatarUrl,
                name: "System",
                isUser: false
            }];
        }

        // [CRITICAL FIX] 检查全局新游戏标志
        if (window.GAL_NEW_GAME_FLAG) {
            console.log("[GameFlow] New Game Flag detected. Resetting index to 0.");
            forceReset = true;
            window.GAL_NEW_GAME_FLAG = false; // Consume flag
        }

        if (forceReset) {
            this.state.playIndex = 0;
        } else {
            // 常规逻辑...
            const lastMsgElement = msgs[msgs.length - 1];
            const chat = this.adapter.getChat();
            const lastMsg = chat[chat.length - 1];

            if (lastMsg && lastMsg.metadata && lastMsg.metadata.gal_game_data) {
                const saveData = lastMsg.metadata.gal_game_data;
                if (saveData.playIndex !== undefined) {
                    this.state.playIndex = saveData.playIndex;
                } else {
                    this.state.playIndex = Math.max(0, this.state.playList.length - 1);
                }
            } else {
                const charName = this.adapter.getCurrentCharacterName();
                const savedIndex = this.localStorage.loadAutoProgress(charName);
                if (savedIndex !== null) {
                    this.state.playIndex = savedIndex;
                } else {
                    this.state.playIndex = Math.max(0, this.state.playList.length - 1);
                }
            }
        }

        this.state.playIndex = Math.max(0, Math.min(this.state.playIndex, this.state.playList.length - 1));
        this.state.maxPlayIndex = this.state.playIndex;

        this.renderCurrentFrame();
    }

    // ... rebuildHistoryUntil and updateStreamingContent (No major changes needed) ...
    /**
     * Rebuilds history frames up to a specific message ID.
     * [Refactor] Now returns the list instead of modifying state directly to prevent UI jumps.
     */
    rebuildHistoryUntil(targetMsgId) {
        const msgs = document.querySelectorAll('.mes');
        const newPlayList = [];
        let lastHistoryImg = this.state.characterAvatarUrl;

        for (let i = 0; i < msgs.length; i++) {
            if (i >= targetMsgId) break;
            const msgFrames = this.playlistEngine.buildPlaylist(msgs[i], lastHistoryImg, i);
            if (msgFrames.length > 0) {
                newPlayList.push(...msgFrames);
                lastHistoryImg = msgFrames[msgFrames.length - 1].img;
            } else {
                const firstImg = this.imageService.getFirstImage(msgs[i]);
                if (firstImg) lastHistoryImg = firstImg;
            }
        }

        if (newPlayList.length === 0) {
            newPlayList.push({ text: "...", img: this.state.characterAvatarUrl, name: "System", isUser: false });
        }

        return newPlayList;
    }

    /**
     * Detect if the content is still in CoT/thinking phase
     * @param {string} text - Raw text content
     * @returns {boolean} True if content is wrapped in thinking tags without closing
     */
    _isThinkingContent(text) {
        if (!text || text.length < 10) return true; // Too short, probably still loading

        // Check for <thinking> or <think> tags
        const hasOpenThink = /<think(ing)?>/i.test(text);
        const hasCloseThink = /<\/think(ing)?>/i.test(text);

        // If has opening tag but no closing tag, still in thinking mode
        if (hasOpenThink && !hasCloseThink) {
            return true;
        }

        // If has both tags, check if there's content AFTER the closing tag
        if (hasOpenThink && hasCloseThink) {
            const afterThinking = text.replace(/<think(ing)?>[^]*<\/think(ing)?>/gi, '').trim();
            return afterThinking.length < 10; // No real content after thinking
        }

        return false; // No thinking tags, it's real content
    }

    updateStreamingContent(msgId, isFinal = false) {
        const ctx = this.adapter.getContext();
        if (!ctx || !ctx.chat || !ctx.chat[msgId]) return;

        let rawText = ctx.chat[msgId].mes || "";
        if (!rawText && !isFinal) return;

        // Build temporary DOM element for parsing
        const tempDiv = document.createElement('div');
        tempDiv.className = 'mes_text';
        let formattedText = rawText.replace(/\r\n/g, '\n').replace(/\n/g, '<br>');
        tempDiv.innerHTML = formattedText;

        const tempMsgElement = document.createElement('div');
        tempMsgElement.classList.add('mes');
        tempMsgElement.setAttribute('is_user', 'false');

        const nameDiv = document.createElement('div');
        nameDiv.className = 'name_text';
        nameDiv.innerText = this.adapter.getCurrentCharacter()?.name || 'AI';

        tempMsgElement.appendChild(nameDiv);
        tempMsgElement.appendChild(tempDiv);

        let initialBg = this.state.characterAvatarUrl;
        if (this.state.streamingStartIndex > 0 && this.state.playList[this.state.streamingStartIndex - 1]) {
            initialBg = this.state.playList[this.state.streamingStartIndex - 1].img;
        }

        const newFrames = this.playlistEngine.buildPlaylist(tempMsgElement, initialBg, msgId);

        // Update Playlist - replace streaming portion only
        if (newFrames.length > 0 || isFinal) {
            const oldHistory = this.state.playList.slice(0, this.state.streamingStartIndex);
            this.state.playList = oldHistory.concat(newFrames);

            // Hide loading indicator only when REAL content (not CoT/thinking) is available
            if (this.state.playList.length > this.state.streamingStartIndex) {
                // Check if the content looks like actual narrative vs thinking/CoT
                const isThinkingContent = this._isThinkingContent(rawText);

                if (!isThinkingContent || isFinal) {
                    $('#gal-loading-overlay').fadeOut(200);
                }
            }
        }

        // Update maxPlayIndex
        this.state.maxPlayIndex = Math.max(this.state.maxPlayIndex, this.state.playList.length - 1);

        // Update progress indicator only (no auto-scroll, user controls navigation)
        this.dialogueBox.updateProgressIndicator();

        // If user is viewing the last frame (streaming frame), update text content live
        if (this.state.playIndex >= this.state.streamingStartIndex &&
            this.state.playIndex === this.state.playList.length - 1) {
            const currentFrame = this.state.playList[this.state.playIndex];
            if (currentFrame) {
                this.dialogueBox.updateTextOnly(currentFrame.text);
            }
        }
    }

    handleMessageReceived(msgId) {
        console.log(`[GameFlow] Msg ${msgId} received. Rebuilding from DOM...`);

        // Hide loading indicator
        $('#gal-loading-overlay').fadeOut(200);

        // Save the current playIndex to restore after rebuild
        const savedPlayIndex = this.state.playIndex;
        const savedMaxPlayIndex = this.state.maxPlayIndex;

        // Rebuild playlist from actual DOM (authoritative source after streaming completes)
        this.loadAllMessages();

        // Restore playIndex, clamped to valid range
        this.state.playIndex = Math.min(savedPlayIndex, this.state.playList.length - 1);
        this.state.playIndex = Math.max(0, this.state.playIndex);

        // Update maxPlayIndex to include new content
        this.state.maxPlayIndex = Math.max(savedMaxPlayIndex, this.state.playList.length - 1);

        this.state.resumePlayIndex = null;
        this.state.pendingGeneration = false;
        this.state.isActiveMode = true;

        console.log(`[GameFlow] Rebuild complete: ${this.state.playList.length} frames, playIndex=${this.state.playIndex}`);

        // Render current frame and check for interactions
        this.renderCurrentFrame();
    }

    setupStreamingListeners(messageId) {
        this.state.resumePlayIndex = this.state.playIndex;

        // [Fix] Don't nuke playList. Calculate history frames safely.
        const historyFrames = this.rebuildHistoryUntil(messageId);
        this.state.streamingStartIndex = historyFrames.length;

        // Set playlist to history. New streaming frames will be appended by updateStreamingContent.
        this.state.playList = historyFrames;

        this.state.streamingMessageId = messageId;

        const success = this.eventHandler.setupStreamingListeners(
            messageId,
            () => this.updateStreamingContent(messageId, false),
            (receivedId) => this.handleMessageReceived(receivedId)
        );

        if (!success) this.setupFallbackPolling(messageId);
    }

    setupFallbackPolling(messageId) {
        let pollCount = 0;
        // Note: streaming state (playList, streamingStartIndex, resumePlayIndex) is already set by continueStory

        const checkInterval = setInterval(() => {
            pollCount++;
            const isGenerating = this.adapter.isGenerating();
            if (isGenerating) this.updateStreamingContent(messageId, false);
            if (!isGenerating && pollCount > 5) {
                clearInterval(checkInterval);
                this.handleMessageReceived(messageId);
            }
        }, 500);
    }

    async continueStory() {
        try {
            this.choiceSystem.hideContinueButton();
            this.state.pendingGeneration = true;

            // Show loading indicator
            $('#gal-loading-overlay').fadeIn(200);

            // [Critical Fix] Save the CURRENT playlist state BEFORE triggering generation.
            // This prevents frame count reduction due to DOM state changes.
            const savedPlayList = [...this.state.playList];
            const savedPlayIndex = this.state.playIndex;

            const ctx = this.adapter.getContext();
            const expectedMessageId = ctx.chat.length; // The NEW message's ID

            await this.adapter.sendMessage('');
            await new Promise(resolve => setTimeout(resolve, 150));

            // Set up streaming state using saved values (NOT from DOM rebuild)
            this.state.streamingStartIndex = savedPlayList.length;
            this.state.playList = savedPlayList;
            this.state.playIndex = savedPlayIndex;
            this.state.resumePlayIndex = savedPlayIndex;
            this.state.streamingMessageId = expectedMessageId;

            console.log(`[GameFlow] Streaming setup: startIndex=${this.state.streamingStartIndex}, msgId=${expectedMessageId}`);

            const success = this.eventHandler.setupStreamingListeners(
                expectedMessageId,
                () => this.updateStreamingContent(expectedMessageId, false),
                (receivedId) => this.handleMessageReceived(receivedId)
            );

            if (!success) this.setupFallbackPolling(expectedMessageId);
        } catch (error) {
            console.error('[GameFlow] Continue failed:', error);
            this.state.pendingGeneration = false;
            $('#gal-loading-overlay').fadeOut(200);
            this.choiceSystem.showContinueButton(() => this.continueStory());
        }
    }

    enterActiveMode() {
        this.state.isActiveMode = true;
        $('#gal-next-indicator').removeClass('visible');
    }

    renderCurrentFrame(skipTypewriter = false) {
        if (!this.state.playList || this.state.playList.length === 0) return;

        // [Fix] Ensure playIndex is within bounds
        if (this.state.playIndex >= this.state.playList.length) {
            this.state.playIndex = this.state.playList.length - 1;
        }
        if (this.state.playIndex < 0) {
            this.state.playIndex = 0;
        }

        const frame = this.state.playList[this.state.playIndex];
        this.dialogueBox.renderFrame(frame, skipTypewriter);
        if (this.state.playIndex === this.state.playList.length - 1 &&
            this.state.playIndex === this.state.maxPlayIndex) {
            if (this.state.isActiveMode && !this.state.pendingGeneration) {
                $('#gal-next-indicator').removeClass('visible');
                this.checkForInteraction(frame);
            } else if (!this.state.isActiveMode) {
                this.enterActiveMode();
                this.checkForInteraction(frame);
            }
        } else if (this.state.isActiveMode) {
            $('#gal-next-indicator').removeClass('visible');
            this.choiceSystem.hideChoices();
            this.choiceSystem.hideContinueButton();
        }
    }

    /**
     * [Fix] Added Null Check for frame
     */
    checkForInteraction(frame) {
        if (!frame) {
            // Try to recover current frame
            if (this.state.playList && this.state.playList[this.state.playIndex]) {
                frame = this.state.playList[this.state.playIndex];
            } else {
                console.warn("[GameFlow] Frame is undefined in checkForInteraction");
                // Stop here to avoid crash
                return;
            }
        }

        const hasChoices = this.choiceController.checkAndRenderChoices(frame, (choice) => {
            this.choiceController.selectChoice(choice, () => {
                const ctx = this.adapter.getContext();
                const expectedMessageId = ctx.chat.length - 1;
                this.state.pendingGeneration = true;
                this.setupStreamingListeners(expectedMessageId);
            });
        });

        if (!hasChoices) {
            setTimeout(() => {
                this.choiceSystem.showContinueButton(() => this.continueStory());
            }, 500);
        }
    }

    autoSave() {
        const charName = this.adapter.getCurrentCharacterName();
        this.localStorage.saveAutoProgress(charName, this.state.playIndex);
    }
}
