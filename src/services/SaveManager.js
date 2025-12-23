/**
 * SaveManager.js
 * Galgame 存档系统 - 独立文件策略 (Fixed Integrity & Performance)
 * 
 * 【V3.1 - Integrity Fix】
 * 1. 修复 ST 1.12+ 保存时的 {"error":"integrity"} 问题 (添加 force: true)
 * 2. 优化错误处理，防止读写失败导致 UI 卡死
 */
export class SaveManager {
    /**
     * @param {import('../adapters/STAdapter.js').STAdapter} adapter 
     */
    constructor(adapter) {
        this.adapter = adapter;
        this.FILE_PREFIX = '[GAL] Slot '; // 存档文件前缀
    }

    /**
     * 获取带 CSRF Token 的请求头
     * @private
     */
    async _getAuthHeaders() {
        try {
            // 尝试获取 CSRF Token，兼容新版 ST 安全策略
            const res = await fetch('/csrf-token');
            if (res.ok) {
                const data = await res.json();
                return {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': data.token
                };
            }
        } catch (e) {
            // 忽略错误，回退到默认头
        }
        return { 'Content-Type': 'application/json' };
    }

    /**
     * 获取当前角色信息
     * @private
     */
    _getContextInfo() {
        const ctx = window.SillyTavern?.getContext();
        if (!ctx || ctx.characterId === undefined) return null;

        const char = ctx.characters[ctx.characterId];
        const currentFile = ctx.chatId || null;

        return {
            avatar: char.avatar,
            name: char.name,
            currentFile: currentFile ? currentFile.replace(/\.jsonl$/, '') : null
        };
    }

    /**
     * 列出所有 GAL 存档
     * @returns {Promise<Array>} 存档列表
     */
    async listSaves() {
        const info = this._getContextInfo();
        if (!info) throw new Error("未选择角色");

        const headers = await this._getAuthHeaders();

        try {
            const response = await fetch('/api/characters/chats', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ avatar_url: info.avatar })
            });

            if (!response.ok) throw new Error("Failed to fetch chat list");

            const data = await response.json();
            const allChats = Array.isArray(data) ? data : Object.values(data);

            // 过滤 GAL 存档文件
            const galSaves = allChats
                .filter(chat => chat.file_name && chat.file_name.includes(this.FILE_PREFIX))
                .map(chat => ({
                    fileName: chat.file_name.replace(/\.jsonl$/, ''),
                    displayName: chat.file_name
                        .replace(this.FILE_PREFIX, '')
                        .replace('.jsonl', '')
                        .trim(),
                    lastModified: chat.last_mes || 'Unknown',
                    isCurrent: chat.file_name.replace(/\.jsonl$/, '') === info.currentFile
                }));

            // 按最后修改时间排序 (可选)
            galSaves.sort((a, b) => b.lastModified - a.lastModified);

            return galSaves;

        } catch (e) {
            console.error("[SaveManager] List saves failed:", e);
            return []; // 失败返回空数组，不炸掉 UI
        }
    }

    /**
     * 检查槽位状态 (获取详细元数据)
     * @param {string} slotId - 例如 "1", "2", "3"
     * @returns {Promise<Object|null>} 返回详细状态对象
     */
    async checkSlot(slotId) {
        try {
            const targetName = `${this.FILE_PREFIX}${slotId}`;
            const info = this._getContextInfo();
            if (!info) return null;

            // 1. 先检查文件是否存在 (快速检查)
            // 注意：为了性能，如果存档列表很大，这里频繁调用 listSaves 可能会慢
            // 理想情况是 UI 层缓存 listSaves 的结果
            const saves = await this.listSaves();
            const save = saves.find(s => s.fileName === targetName);
            if (!save) return null;

            // 2. 获取详细元数据 (慢速 I/O)
            // 仅当需要显示详细预览时调用
            const headers = await this._getAuthHeaders();
            const response = await fetch('/api/chats/get', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    ch_name: info.name,
                    avatar_url: info.avatar,
                    file_name: targetName
                })
            });

            // 如果读取失败，至少返回基本信息
            if (!response.ok) {
                return {
                    exists: true,
                    displayName: save.displayName,
                    date: new Date(parseInt(save.lastModified)).toLocaleString(),
                    isCurrent: save.isCurrent,
                    preview: "(无法读取详情)",
                    playIndex: "?",
                };
            }

            const chatData = await response.json();
            let galData = null;

            // 提取元数据
            if (chatData[0]?.chat_metadata?.gal_save_data) {
                galData = chatData[0].chat_metadata.gal_save_data;
            } else if (chatData.length > 0 && chatData[chatData.length - 1]?.chat_metadata?.gal_save_data) {
                galData = chatData[chatData.length - 1].chat_metadata.gal_save_data;
            }

            let timeStr = save.lastModified;
            try {
                if (!isNaN(save.lastModified)) {
                    timeStr = new Date(parseInt(save.lastModified)).toLocaleString();
                }
            } catch (e) { }

            if (galData) {
                return {
                    exists: true,
                    displayName: save.displayName,
                    date: timeStr,
                    isCurrent: save.isCurrent,
                    preview: galData.stats?.previewText || "无预览文本",
                    playIndex: (galData.gameState?.playIndex || 0) + 1,
                    totalFrames: galData.stats?.totalFrames || 0,
                    timestamp: galData._saved_at
                };
            }

            return {
                exists: true,
                displayName: save.displayName,
                date: timeStr,
                isCurrent: save.isCurrent,
                preview: "旧版存档 (无详细元数据)",
                playIndex: "?",
                totalFrames: "?"
            };

        } catch (e) {
            console.warn("[SaveManager] Check slot warning:", e);
            return null;
        }
    }

    /**
     * 删除指定聊天文件
     */
    async deleteChatFile(fileName) {
        const info = this._getContextInfo();
        if (!info) return;

        const headers = await this._getAuthHeaders();
        try {
            await fetch('/api/chats/delete', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    chatfile: fileName.endsWith('.jsonl') ? fileName : `${fileName}.jsonl`,
                    avatar_url: info.avatar
                })
            });
            console.log(`[SaveManager] Deleted file: ${fileName}`);
        } catch (e) {
            console.error(`[SaveManager] Failed to delete ${fileName}:`, e);
        }
    }

    /**
     * 保存游戏 - 核心方法
     * @param {string} slotId - 槽位ID
     * @param {object} gameState - 游戏状态
     */
    async saveGame(slotId, gameState) {
        console.log(`[SaveManager] 💾 开始保存到 Slot ${slotId}...`);

        const info = this._getContextInfo();
        if (!info || !info.currentFile) {
            throw new Error("未找到当前聊天，请先开始一个对话");
        }

        const headers = await this._getAuthHeaders();
        const sourceFile = info.currentFile;
        const targetFile = `${this.FILE_PREFIX}${slotId}`;

        try {
            // === STEP 1: 读取当前聊天的完整数据 ===
            console.log(`[SaveManager] 📖 读取源文件: ${sourceFile}`);

            const readResponse = await fetch('/api/chats/get', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    ch_name: info.name,
                    avatar_url: info.avatar,
                    file_name: sourceFile
                })
            });

            if (!readResponse.ok) {
                throw new Error(`读取源文件失败: ${readResponse.status}`);
            }

            const chatData = await readResponse.json();
            console.log(`[SaveManager] ✅ 读取成功，共 ${chatData.length} 条消息`);

            // === STEP 2: 注入 GAL 元数据 ===
            const galMetadata = {
                _plugin: "sgal-mode",
                _version: "3.1", // Version bump
                _saved_at: Date.now(),
                _timestamp_str: new Date().toLocaleString(),
                _source_file: sourceFile,
                gameState: {
                    playIndex: gameState.playIndex || 0,
                    maxPlayIndex: gameState.maxPlayIndex || gameState.playIndex || 0,
                    playlistSnapshot: gameState.playList || [],
                    characterAvatar: gameState.characterAvatarUrl || info.avatar,
                    typewriterSpeed: gameState.typewriterSpeed,
                    autoPlayDelay: gameState.autoPlayDelay,
                    customState: gameState.customState || {}
                },
                stats: {
                    totalFrames: gameState.playList?.length || 0,
                    totalMessages: chatData.length,
                    previewText: document.querySelector('#gal-text-content')?.innerText.substring(0, 50) || "No preview"
                }
            };

            // 注入元数据到第一条消息
            if (chatData[0]) {
                chatData[0].create_date = Date.now();
                if (!chatData[0].chat_metadata) chatData[0].chat_metadata = {};
                chatData[0].chat_metadata.gal_save_data = galMetadata;
            } else {
                chatData.unshift({
                    name: "System",
                    is_user: false,
                    is_system: true,
                    send_date: Date.now(),
                    mes: `Galgame Save: Slot ${slotId} (${new Date().toLocaleString()})`,
                    chat_metadata: { gal_save_data: galMetadata }
                });
            }

            // === STEP 3: 保存到目标文件 (修复: 添加 force: true) ===
            console.log(`[SaveManager] 💾 写入目标文件: ${targetFile} (Force Save)`);

            const saveResponse = await fetch('/api/chats/save', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    ch_name: info.name,
                    file_name: targetFile,
                    chat: chatData,
                    avatar_url: info.avatar,
                    force: true // 【关键修复】强制绕过 Integrity Check
                })
            });

            if (!saveResponse.ok) {
                const errorText = await saveResponse.text();
                throw new Error(`保存失败 (API ${saveResponse.status}): ${errorText}`);
            }

            // === STEP 4: 成功 ===
            console.log(`[SaveManager] ✅ Slot ${slotId} 保存成功！`);
            if (window.toastr) window.toastr.success(`存档已保存到 Slot ${slotId}`);

            return true;

        } catch (e) {
            console.error("[SaveManager] Save failed:", e);
            if (window.toastr) {
                window.toastr.error(`保存失败: ${e.message}`);
            }
            throw e; // 抛出异常以便 UI 层知道操作失败
        }
    }

    /**
     * 读取存档
     */
    async loadGame(slotId) {
        console.log(`[SaveManager] 📂 读取 Slot ${slotId}...`);
        const info = this._getContextInfo();
        const targetFile = `${this.FILE_PREFIX}${slotId}`;

        try {
            const headers = await this._getAuthHeaders();
            const readResponse = await fetch('/api/chats/get', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    ch_name: info.name,
                    avatar_url: info.avatar,
                    file_name: targetFile
                })
            });

            if (!readResponse.ok) throw new Error("读取存档文件失败");

            const chatData = await readResponse.json();

            // 提取 GAL 元数据
            let galData = null;
            if (chatData[0]?.chat_metadata?.gal_save_data) {
                galData = chatData[0].chat_metadata.gal_save_data;
            } else if (chatData.length > 0 && chatData[chatData.length - 1]?.chat_metadata?.gal_save_data) {
                galData = chatData[chatData.length - 1].chat_metadata.gal_save_data;
            }

            if (galData && galData.gameState) {
                console.log(`[SaveManager] ✅ 成功预加载元数据`);
                window.GAL_PENDING_LOAD_STATE = galData.gameState;
            } else {
                console.warn("[SaveManager] ⚠️ 未找到 GAL 元数据，使用默认状态...");
                window.GAL_PENDING_LOAD_STATE = { playIndex: 0, playlistSnapshot: [] };
            }

            // 触发 ST 加载聊天，这通常会导致页面刷新或 DOM 重建
            await this.adapter.loadChat(targetFile);

            if (window.toastr) window.toastr.success(`存档 ${slotId} 读取成功`);

        } catch (e) {
            console.error("[SaveManager] Load failed:", e);
            if (window.toastr) window.toastr.error(`读取失败: ${e.message}`);
        }
    }

    /**
     * 删除存档
     */
    async deleteSlot(slotId) {
        const info = this._getContextInfo();
        if (!info) throw new Error("未选择角色");

        const headers = await this._getAuthHeaders();
        const targetFile = `${this.FILE_PREFIX}${slotId}`;

        try {
            const response = await fetch('/api/chats/delete', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    chatfile: `${targetFile}.jsonl`,
                    avatar_url: info.avatar
                })
            });

            if (!response.ok) throw new Error("删除失败");

            console.log(`[SaveManager] 🗑️ Slot ${slotId} 已删除`);
            if (window.toastr) window.toastr.success(`Slot ${slotId} 已删除`);

            return true;
        } catch (e) {
            console.error("[SaveManager] Delete failed:", e);
            if (window.toastr) window.toastr.error(`删除失败: ${e.message}`);
            throw e;
        }
    }

    /**
     * 检查并执行挂起的删除操作
     */
    async checkPendingDelete() {
        try {
            const pendingFile = sessionStorage.getItem('GAL_PENDING_DELETE');
            if (pendingFile) {
                console.log(`[SaveManager] Found pending delete: ${pendingFile}`);
                sessionStorage.removeItem('GAL_PENDING_DELETE'); // 先移除防止循环
                setTimeout(async () => {
                    await this.deleteChatFile(pendingFile);
                }, 2000);
            }
        } catch (e) {
            console.warn("[SaveManager] Error checking pending delete:", e);
        }
    }
}
