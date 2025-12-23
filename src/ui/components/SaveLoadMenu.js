/**
 * SaveLoadMenu.js
 * 负责存档/读档界面的渲染和逻辑交互
 */
export class SaveLoadMenu {
    /**
     * @param {import('../../services/SaveManager.js').SaveManager} saveManager 
     */
    constructor(saveManager) {
        this.saveManager = saveManager;
        this.onLoadCallback = null;
    }

    initialize(onLoadCallback) {
        this.onLoadCallback = onLoadCallback;
        console.log("[SaveLoadMenu] Initialized");
    }

    /**
     * 供 UIManager 调用的接口：显示存档菜单
     * @param {Object} options - 可选配置 { onSave: function(slotId) }
     */
    showSaveMenu(options = {}) {
        console.log("[SaveLoadMenu] Opening Save Menu...");
        this.show('save', options);
    }

    /**
     * 供 UIManager 调用的接口：显示读档菜单
     */
    showLoadMenu() {
        console.log("[SaveLoadMenu] Opening Load Menu...");
        this.show('load');
    }

    /**
     * 核心显示逻辑
     * @param {'save'|'load'} type 
     * @param {Object} options
     */
    async show(type, options = {}) {
        this.currentOptions = options; // 保存配置供 doSave 使用

        // 0. 获取当前聊天文件，用于高亮当前存档
        const currentFileName = this.saveManager.adapter.getCurrentChatFile();
        console.log(`[SaveLoadMenu] Current file: ${currentFileName}`);

        // 1. 清理旧菜单（防止重复打开）
        $('.gal-menu-overlay').remove();

        // 2. 构建基础 HTML 结构
        const $overlay = $('<div class="gal-menu-overlay"></div>');
        const $container = $('<div class="gal-menu-container"></div>');
        const title = type === 'save' ? '保存游戏 (Save Game)' : '读取进度 (Load Game)';

        $container.append(`<h2>${title}</h2>`);
        const $slots = $('<div class="gal-slots-grid"></div>');

        // 3. 生成 4 个存档槽位
        for (let i = 1; i <= 4; i++) {
            const slotId = `Slot_${i}`;
            // 必须与 SaveManager.FILE_PREFIX 保持一致
            const slotFileName = `[GAL] Slot ${i}`;

            // 判断这个格子是不是当前所在的存档
            const isCurrent = currentFileName === slotFileName ||
                (currentFileName && currentFileName.includes(slotFileName));

            // 创建槽位 DOM (初始状态: Checking...)
            const $slot = $(`
                <div class="gal-save-slot ${isCurrent ? 'current-active-slot' : ''}" id="gal-slot-${i}" data-id="${slotId}">
                    <div class="slot-id">SLOT ${i}</div>
                    ${isCurrent ? '<div class="current-badge">📍 当前运行中</div>' : ''}
                    <div class="slot-info">Checking...</div>
                </div>
            `);

            // 绑定点击事件
            $slot.on('click', async () => {
                // 获取当前槽位最新的状态文本，判断是否为空（通过 CSS class 或 文本内容）
                const isOccupied = $slot.hasClass('occupied');

                if (type === 'save') {
                    // 存档模式：总是允许点击（覆盖或新建）
                    await this.doSave(slotId);
                } else {
                    // 读档模式：只有存在的槽位才能点
                    if (isOccupied) {
                        await this.doLoad(slotId);
                    } else {
                        if (window.toastr) window.toastr.warning("这个槽位是空的");
                    }
                }
            });

            $slots.append($slot);

            // 异步检查槽位状态
            this.refreshSlotState($slot, slotId);
        }

        // 4. 底部关闭按钮
        const $closeBtn = $('<button class="gal-close-btn">关闭 / Close</button>');
        $closeBtn.on('click', () => $overlay.remove());

        $container.append($slots);
        $container.append($closeBtn);
        $overlay.append($container);

        // 5. 添加到页面 (优先添加到 #gal-overlay 内部以确保在 GAL 模式中显示在最上层)
        const $target = $('#gal-overlay').length > 0 ? $('#gal-overlay') : $('body');
        $target.append($overlay);
    }

    /**
     * 刷新单个槽位的显示状态
     */
    async refreshSlotState($slot, slotId) {
        try {
            const status = await this.saveManager.checkSlot(slotId);
            const $info = $slot.find('.slot-info');

            if (status && status.exists) {
                // 丰富的信息显示
                // 截取预览文本
                const preview = status.preview.length > 30 ? status.preview.substring(0, 30) + "..." : status.preview;

                let html = `
                    <div class="slot-date">${status.date}</div>
                    <div class="slot-preview" title="${status.preview}">${preview}</div>
                    <div class="slot-progress">进度: ${status.playIndex} / ${status.totalFrames}</div>
                `;
                $info.html(html);
                $slot.addClass('occupied').removeClass('empty');

                // 更新当前标记 (以 checkSlot 结果为准)
                if (status.isCurrent) {
                    if ($slot.find('.current-badge').length === 0) {
                        $slot.prepend('<div class="current-badge">📍 当前运行中</div>');
                    }
                    $slot.addClass('current-active-slot');
                }
            } else {
                $info.text("---- Empty ----");
                $slot.addClass('empty').removeClass('occupied');
                $slot.find('.current-badge').remove();
                $slot.removeClass('current-active-slot');
            }
        } catch (e) {
            console.warn(`[SaveLoadMenu] Error checking ${slotId}:`, e);
            $slot.find('.slot-info').text("Error");
        }
    }

    /**
     * 执行保存
     */
    async doSave(slotId) {
        if (!window.GAL_DEBUG || !window.GAL_DEBUG.state) {
            console.warn("[SaveLoadMenu] GAL_DEBUG.state missing, trying global fallback...");
        }

        // 获取当前进度索引
        let currentIndex = 0;
        if (window.GAL_DEBUG && window.GAL_DEBUG.getPlayIndex) {
            currentIndex = window.GAL_DEBUG.getPlayIndex();
        }

        if (confirm(`确定要保存当前进度到 ${slotId} 吗?\n这将创建一个新的聊天记录文件。`)) {
            try {
                const state = {
                    playIndex: currentIndex,
                    playList: window.GAL_DEBUG?.state?.playList || [],
                    timestamp: Date.now()
                };

                if (window.toastr) window.toastr.info("正在保存...");

                await this.saveManager.saveGame(slotId, state);

                if (window.toastr) window.toastr.success("保存成功!");

                // 执行回调 (例如 New Game 流程)
                if (this.currentOptions && this.currentOptions.onSave) {
                    await this.currentOptions.onSave(slotId);
                }

                // 刷新该槽位的显示
                const $slot = $(`#gal-slot-${slotId.replace('Slot_', '')}`);
                if ($slot.length) {
                    this.refreshSlotState($slot, slotId);
                }

                // 如果是 New Game 流程，可能需要关闭菜单
                if (this.currentOptions && this.currentOptions.autoClose) {
                    $('.gal-menu-overlay').remove();
                }

            } catch (e) {
                alert("保存失败: " + e.message);
                console.error(e);
            }
        }
    }

    /**
     * 执行读取
     */
    async doLoad(slotId) {
        if (confirm(`确定要读取 ${slotId} 吗?\n页面将刷新并切换到该存档。`)) {
            try {
                if (window.toastr) window.toastr.info("正在切换存档...");
                await this.saveManager.loadGame(slotId);
                // 成功后不需要手动关闭菜单，因为页面即将重载或ST会刷新聊天区
                $('.gal-menu-overlay').remove();
            } catch (e) {
                alert("读取失败: " + e.message);
                console.error(e);
            }
        }
    }
}
