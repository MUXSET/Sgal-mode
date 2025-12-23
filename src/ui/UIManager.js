/**
 * UIManager.js
 * Main UI coordinator - manages all UI components and interaction logic
 * [Simplified V9.7 - No Locks, Pure Logic]
 */

export class UIManager {
    constructor(stateManager, components, gameFlowController, navigationController) {
        this.state = stateManager;
        this.components = components;
        this.gameFlowController = gameFlowController;
        this.navigationController = navigationController;
    }

    _buildHTML() {
        const currentFontSize = this.state.currentFontSize;
        return `
        <div id="gal-overlay">
            <div id="gal-bg-blur"></div>
            <div id="gal-bg-layer"></div>
            
            <div id="gal-progress" title="当前进度">1/1</div>

            <div id="gal-controls">
                <button id="gal-history-btn" class="gal-btn" title="历史文本">📜</button>
                <button id="gal-settings-btn" class="gal-btn" title="设置">⚙️</button>
                <button id="gal-save-btn" class="gal-btn" title="存档">💾</button>
                <button id="gal-load-btn" class="gal-btn" title="读档">📂</button>
                <button id="gal-back-btn" class="gal-btn" title="上一句">⬅️</button>
                <button id="gal-prev-btn" class="gal-btn" title="重新播放">⏮️</button>
                <button id="gal-sync-btn" class="gal-btn" title="同步">🔄</button>
                <button id="gal-close-btn" class="gal-btn" title="退出">❌</button>
            </div>

            <div id="gal-settings-menu">
                <div class="gal-setting-item">
                    <label class="gal-setting-label">打字机效果 / Typewriter</label>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <input type="checkbox" id="gal-typewriter-toggle" checked style="cursor:pointer;">
                        <span style="font-size:12px; color:#aaa;">启用</span>
                    </div>
                </div>
                <div class="gal-setting-item">
                    <label class="gal-setting-label">打字速度 / Speed</label>
                    <input type="range" min="10" max="100" value="50" class="gal-slider" id="gal-typewriter-speed">
                    <div style="text-align:center; font-size:11px; color:#888; margin-top:5px;">
                        <span id="gal-speed-value">50</span> ms/字
                    </div>
                </div>
                <div class="gal-setting-item">
                    <label class="gal-setting-label">字体大小 / Font Size</label>
                    <input type="range" min="18" max="60" value="${currentFontSize}" class="gal-slider" id="gal-font-slider">
                </div>
            </div>

            <!-- 模态框 -->
            <div id="gal-save-menu" class="gal-modal"><div class="gal-modal-content"><h3 id="gal-save-title">存档</h3><div id="gal-save-slots"></div><button class="gal-modal-close">关闭</button></div></div>
            <div id="gal-history-menu" class="gal-modal"><div class="gal-modal-content"><h3>历史文本</h3><div id="gal-history-content"></div><button class="gal-modal-close">关闭</button></div></div>
            <div id="gal-character-selector" class="gal-modal"><div class="gal-modal-content"><h3>选择卡带</h3><div id="gal-character-grid"></div><button id="gal-character-selector-close" class="gal-modal-close">取消</button></div></div>

            <div id="gal-dialogue-box">
                <div id="gal-name-tag">System</div>
                <div id="gal-text-content" style="font-size: ${currentFontSize}px">Loading...</div>
                <div id="gal-next-indicator"></div>
            </div>

            <!-- 交互层 -->
            <div id="gal-continue-container" class="gal-interaction-layer" style="display: none;">
                <button id="gal-continue-btn" class="gal-action-btn">▶ Continue Story / 继续故事</button>
            </div>
            <div id="gal-choice-container" class="gal-interaction-layer" style="display: none;">
                <div class="gal-choice-prompt">请选择 / Please choose:</div>
                <div id="gal-choice-list"></div>
            </div>
            
            <!-- Loading Indicator -->
            <div id="gal-loading-overlay" style="display: none;">
                <div class="gal-loading-spinner"></div>
                <div class="gal-loading-text">Generating... / 生成中...</div>
            </div>
        </div>
        `;
    }

    initialize() {
        if ($('#gal-overlay').length === 0) {
            $('body').append(this._buildHTML());
        }

        this.components.dialogueBox.initialize();
        this.components.settingsMenu.initialize();
        this.components.saveLoadMenu.initialize();
        this.components.historyMenu.initialize();
        this.components.choiceSystem.initialize();

        this.components.controlPanel.initialize({
            close: () => this.closeGALMode(),
            prev: () => { this.navigationController.restart(); this.hideGameplayUI(); },
            back: () => { this.navigationController.prev(); this.hideGameplayUI(); },
            settings: () => this.components.settingsMenu.toggle(),
            save: () => this.components.saveLoadMenu.showSaveMenu(),
            load: () => this.components.saveLoadMenu.showLoadMenu(),
            history: () => this.components.historyMenu.show((index) => {
                this.navigationController.jumpTo(index);
                this.hideGameplayUI();
            }),
            sync: () => { this.syncMessages(); this.hideGameplayUI(); }
        });

        this.setupScreenClickHandler();
        this.setupActivateButton();

        // 监听读档事件
        $(document).on('gal:load-save', () => {
            this.gameFlowController.renderCurrentFrame();
            this.hideGameplayUI();
        });
        $(document).on('gal:force-sync-ui', () => this.hideGameplayUI());
        $(document).on('gal:new-game-ready', () => this.hideGameplayUI());

        // 关闭按钮逻辑
        $('.gal-modal-close').off('click').on('click', function () {
            $(this).closest('.gal-modal').removeClass('active');
        });
        $('#gal-character-selector-close').off('click').on('click', () => {
            $('#gal-character-selector').removeClass('active');
        });

        if (this.components.saveLoadMenu?.saveManager) {
            this.components.saveLoadMenu.saveManager.checkPendingDelete();
        }

        console.log("GAL Mode V9.7 (Simplified Click Logic) Ready.");
    }

    /**
     * [核心修复] 极简化的点击逻辑
     * 不再做复杂的 visible 判断，只关注业务逻辑：
     * 1. 打字没完? -> 跳过
     * 2. 有下一页? -> 翻页
     * 3. 是最后一页? -> 尝试交互
     */
    setupScreenClickHandler() {
        $('#gal-overlay').off('click').on('click', (e) => {
            // 1. 忽略 UI 元素点击
            if ($(e.target).closest('.gal-btn, .gal-modal, #gal-controls, #gal-settings-menu, .gal-title-btn, .gal-interaction-layer').length > 0) {
                return;
            }

            // 2. Modal 优先关闭
            if ($('.gal-modal.active, #gal-settings-menu.active').length > 0) {
                $('.gal-modal').removeClass('active');
                $('#gal-settings-menu').removeClass('active');
                return;
            }

            // 3. 选区忽略
            if (window.getSelection().toString().length > 0) return;
            if ($('body').hasClass('gal-title-active')) return;

            // 4. 打字机跳过
            const typewriter = this.components.typewriter;
            if (typewriter.skip()) {
                this.components.dialogueBox.setText(typewriter.getCurrentText(), false);
                return;
            }

            // 5. 翻页逻辑 (如果有下一页)
            if (this.state.playIndex < this.state.playList.length - 1) {
                this.navigationController.next(); // 这里内部会 playIndex++
                this.hideGameplayUI(); // 翻页时必须隐藏之前的按钮
                return;
            }

            // 6. 已经是最后一页
            const isGenerating = !$('#send_but').is(':visible');

            if (isGenerating) {
                // 生成中 -> 只刷新进度显示，不主动调用 updateStreamingContent
                // updateStreamingContent 会通过事件监听自动被调用
                this.components.dialogueBox.updateProgressIndicator();

                // 如果有新帧可用（流式传输期间产生的），翻到下一页
                if (this.state.playList.length > this.state.playIndex + 1) {
                    this.navigationController.next();
                    this.hideGameplayUI();
                }
            } else {
                // 空闲状态 -> 检查交互
                console.log("[UIManager] Last page click -> Check Interaction");
                const currentFrame = this.state.playList[this.state.playIndex];
                this.gameFlowController.checkForInteraction(currentFrame);
            }
        });
    }

    hideGameplayUI() {
        $('.gal-interaction-layer').hide();
    }

    setupActivateButton() {
        if ($('#activate-gal').length === 0) {
            const btn = $('<button id="activate-gal">📺 GAL Mode</button>');
            $('body').append(btn);
            btn.on('click', () => this.showTitleScreen());
        }
    }

    showTitleScreen() {
        $('body').addClass('gal-mode-active');
        this.state.characterAvatarUrl = this.components.imageService.getCharacterAvatar();
        this.components.titleScreen.setHandlers({
            onNewGame: () => this.startNewGame(),
            onContinue: () => this.continueGame(),
            onLoad: () => {
                this.components.titleScreen.hide();
                this.components.saveLoadMenu.showLoadMenu();
            },
            onExit: () => {
                $('body').removeClass('gal-mode-active');
                $('body').removeClass('gal-title-active');
            }
        });
        this.components.titleScreen.show();
    }

    async startNewGame() {
        this.components.titleScreen.hide();
        this.hideGameplayUI();

        if (confirm("开始新游戏将创建一个新的存档文件。继续吗？")) {
            try {
                // 重要：设置全局标志位，告诉 GameFlow 下次加载是新游戏，必须从 0 开始
                window.GAL_NEW_GAME_FLAG = true;

                await this.gameFlowController.adapter.sendCommand('/newchat');
                // 等待 ST 清理完成
                await new Promise(r => setTimeout(r, 1200));

                // 此时 ST 可能已经创建了第一条系统消息或者 AI 正在打招呼
                // GameFlowController.loadAllMessages 可能会被自动触发，也可能需要手动触发

                // 保险起见，触发一次重置事件
                $(document).trigger('gal:new-game-ready');

                const tempFileName = this.components.saveLoadMenu.saveManager.adapter.getCurrentChatFile();
                this.components.saveLoadMenu.showSaveMenu({
                    autoClose: true,
                    onSave: async (slotId) => {
                        await this.components.saveLoadMenu.saveManager.loadGame(slotId);
                        if (tempFileName && tempFileName !== `[GAL] Slot ${slotId.replace('Slot_', '')}`) {
                            await this.components.saveLoadMenu.saveManager.deleteChatFile(tempFileName);
                        }
                    }
                });
            } catch (e) {
                console.error(e);
                alert("Create failed: " + e.message);
                window.GAL_NEW_GAME_FLAG = false; // 失败回滚
            }
        }
    }

    continueGame() {
        this.components.titleScreen.hide();
        this.gameFlowController.loadAllMessages(false);
        this.hideGameplayUI();
    }

    async switchCharacter(charId, charName) {
        try {
            await this.components.characterManager.switchToCharacter(charId, charName);
            this.state.characterAvatarUrl = this.components.imageService.getCharacterAvatar();
            $('body').addClass('gal-mode-active');
            $('body').addClass('gal-title-active');
            this.components.titleScreen.render();
            this.hideGameplayUI();
        } catch (error) { $('body').addClass('gal-mode-active'); }
    }

    closeGALMode() {
        this.gameFlowController.autoSave();
        $('body').removeClass('gal-mode-active');
        $('body').removeClass('gal-title-active');
        $('#gal-settings-menu').removeClass('active');
        $('.gal-modal').removeClass('active');
        this.hideGameplayUI();
    }

    syncMessages() {
        const ctx = window.SillyTavern.getContext();
        this.gameFlowController.handleMessageReceived(ctx.chat.length - 1);
    }
}
