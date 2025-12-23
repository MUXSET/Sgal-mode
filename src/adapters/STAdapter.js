/**
 * STAdapter.js
 * 负责所有与 SillyTavern 本体的交互操作
 * 
 * 【V6 夺舍版 - Soul Transfer】
 * 1. 修复 currentFile 为 null 的核心 Bug (引入 getContext 标准接口)。
 * 2. 彻底解决 403/400 错误：不再删除文件，而是通过"夺舍"策略覆盖内存。
 * 3. 三种保存情况：原地保存、新建存档、覆盖旧档（夺舍）。
 */
export class STAdapter {
    constructor() {
        this.context = null;
    }

    async init() {
        if (window.SillyTavern) {
            console.log("[STAdapter] Connected.");
            return true;
        }
        return false;
    }

    getContext() {
        return window.SillyTavern && window.SillyTavern.getContext ? window.SillyTavern.getContext() : null;
    }

    getCurrentCharacter() {
        const context = this.getContext();
        if (context && context.characters && context.characterId !== undefined) {
            return context.characters[context.characterId];
        }
        const nameDom = document.getElementById('character_name_div');
        const avatarDom = document.getElementById('avatar_url_pole');
        if (nameDom) {
            return {
                name: nameDom.innerText,
                avatar: avatarDom ? avatarDom.value : 'default.png'
            };
        }
        return null;
    }

    getCurrentCharacterName() {
        const char = this.getCurrentCharacter();
        return char ? char.name : 'Unknown';
    }

    getCurrentCharacterAvatar() {
        const char = this.getCurrentCharacter();
        return char ? char.avatar : '';
    }

    getChat() {
        const ctx = this.getContext();
        return ctx ? ctx.chat : [];
    }

    async getChatFiles() {
        try {
            const char = this.getCurrentCharacter();
            if (!char) return [];
            const response = await $.ajax({
                url: '/api/chats/get',
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ avatar_url: char.avatar })
            });
            if (response) {
                return Object.values(response).map(item =>
                    typeof item === 'string' ? item : item.file_name
                );
            }
        } catch (e) {
            console.error("[STAdapter] Failed to fetch chat list:", e);
        }
        return [];
    }

    /**
     * 获取当前聊天文件名 (精准版)
     */
    getCurrentChatFile() {
        try {
            // 优先使用 ST 官方标准上下文接口
            if (window.SillyTavern && typeof window.SillyTavern.getContext === 'function') {
                const ctx = window.SillyTavern.getContext();
                if (ctx && ctx.chatId) {
                    return ctx.chatId.replace(/\.jsonl$/, '');
                }
            }
            // 备选：直接访问对象
            if (window.SillyTavern && window.SillyTavern.context && window.SillyTavern.context.chatId) {
                return window.SillyTavern.context.chatId.replace(/\.jsonl$/, '');
            }
            // 兜底：从标题栏读取
            const titleEl = document.getElementById('chat_name_pole');
            if (titleEl && titleEl.innerText) {
                return titleEl.innerText.trim().replace(/\.jsonl$/, '');
            }
            // DOM 列表查找
            const activeChat = document.querySelector('.select_chat_block.isActive');
            if (activeChat) {
                return activeChat.getAttribute('file_name').replace(/\.jsonl$/, '');
            }
        } catch (e) {
            console.warn("[STAdapter] Error getting filename:", e);
        }
        return null;
    }

    /**
     * 核心：保存对话 - V6 夺舍版
     * @param {string} targetFileName - 目标存档名 (例如 "GAL_Slot_1")
     */
    async saveChatAs(targetFileName) {
        const currentFile = this.getCurrentChatFile();
        const targetClean = targetFileName.replace(/\.jsonl$/, '');

        console.log(`[STAdapter] Request: Save [${currentFile}] to [${targetClean}]`);

        // ============================================================
        // 情况 1：原地保存
        // ============================================================
        if (currentFile === targetClean || (currentFile && currentFile.includes(targetClean))) {
            console.log("✅ [STAdapter] 原地保存，直接触发写入。");
            this._forceSaveSystem();
            return true;
        }

        // ============================================================
        // 情况 2 & 3：检查目标是否存在
        // ============================================================
        const targetExists = await this._checkFileExists(targetClean);

        if (targetExists) {
            // 情况 3：目标存在 -> 执行"夺舍" (Soul Transfer)
            console.log(`[STAdapter] 目标 ${targetClean} 已存在，执行【内存夺舍覆盖】...`);
            return await this._soulTransferProcess(targetClean);
        } else {
            // 情况 2：目标不存在 -> 执行"另存为" (Branch & Rename)
            if (window.toastr) window.toastr.error("覆盖失败: " + e.message);
            return false;
        }
    }

    /**
     * 新建流程：分支 -> 改名 (适用于空位)
     */
    async _saveAsNewProcess(targetName) {
        try {
            await this.sendCommand('/branch-create');
            await new Promise(r => setTimeout(r, 1000));
            await this.sendCommand(`/renamechat "${targetName}"`);
            await new Promise(r => setTimeout(r, 500));
            return true;
        } catch (e) {
            console.error("[Save As New Failed]", e);
            return false;
        }
    }

    /**
     * 检查文件是否存在
     */
    async _checkFileExists(fileName) {
        try {
            await this.sendCommand('/chat-manager');
            await new Promise(r => setTimeout(r, 500));

            const target = fileName.trim();
            const exists = document.querySelector(`.select_chat_block[file_name="${target}.jsonl"]`) ||
                document.querySelector(`.select_chat_block[file_name="${target}"]`);

            this._closeManagerPopup();
            return !!exists;
        } catch (e) {
            console.warn("[Check File Exists Failed]", e);
            this._closeManagerPopup();
            return false;
        }
    }

    /**
     * 静默加载聊天（不发送同步事件）
     */
    async _loadChatSilent(fileName) {
        const target = fileName.endsWith('.jsonl') ? fileName : `${fileName}.jsonl`;
        try {
            await this.sendCommand('/chat-manager');
            const fileBlock = await this._waitForElement(`.select_chat_block[file_name="${target}"]`, 2000);

            if (fileBlock) {
                $(fileBlock).click();
                this._closeManagerPopup();
                return true;
            }
            this._closeManagerPopup();
            return false;
        } catch (e) {
            this._closeManagerPopup();
            return false;
        }
    }

    /**
     * 强制触发系统保存
     */
    _forceSaveSystem() {
        if (window.saveChat) {
            window.saveChat();
        } else {
            // 模拟输入触发自动保存
            const ta = document.querySelector('#send_textarea');
            if (ta) ta.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }

    /**
     * 加载指定存档（正常版本，会发送同步事件）
     */
    async loadChat(fileName) {
        const target = fileName.endsWith('.jsonl') ? fileName : `${fileName}.jsonl`;
        console.log(`[STAdapter] Loading: ${target}`);

        try {
            await this.sendCommand('/chat-manager');
            const fileBlock = await this._waitForElement(`.select_chat_block[file_name="${target}"]`, 2500);

            if (fileBlock) {
                $(fileBlock).click();
                this._closeManagerPopup();

                // 等待 ST 加载完成
                await new Promise(r => setTimeout(r, 1500));

                console.log("[STAdapter] Dispatching GAL Sync Event...");

                // 发送自定义事件，通知 GameFlowController 刷新 UI
                window.dispatchEvent(new CustomEvent('gal:force-sync-ui', {
                    detail: { fileName: target }
                }));

                return true;
            } else {
                this._closeManagerPopup();
                if (window.toastr) window.toastr.error(`File ${target} not found`);
                throw new Error("File not found");
            }
        } catch (e) {
            this._closeManagerPopup();
            console.error(e);
            return false;
        }
    }

    async loadChatFile(fileName) {
        return this.loadChat(fileName);
    }

    async sendCommand(command) {
        const textarea = document.querySelector('#send_textarea');
        const sendBtn = document.querySelector('#send_but');
        if (!textarea || !sendBtn) return false;

        const descriptor = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value");
        descriptor.set.call(textarea, command);
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        setTimeout(() => sendBtn.click(), 50);
        return true;
    }

    _waitForElement(selector, timeout) {
        return new Promise(resolve => {
            const el = document.querySelector(selector);
            if (el) return resolve(el);
            const observer = new MutationObserver(() => {
                const e = document.querySelector(selector);
                if (e) { observer.disconnect(); resolve(e); }
            });
            observer.observe(document.body, { childList: true, subtree: true });
            setTimeout(() => { observer.disconnect(); resolve(null); }, timeout);
        });
    }

    _closeManagerPopup() {
        const closeBtn = document.getElementById('select_chat_cross');
        if (closeBtn) closeBtn.click();
    }

    async sendMessage(text) {
        const textarea = document.getElementById('send_textarea');
        const sendBtn = document.getElementById('send_but');
        if (textarea && sendBtn) {
            textarea.value = text;
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            sendBtn.click();
            return true;
        }
        return false;
    }

    isGenerating() {
        return !$('#send_but').is(':visible');
    }

    getMessageContent(msgId) {
        const chat = this.getChat();
        if (chat && chat[msgId]) {
            return chat[msgId].mes;
        }
        return null;
    }
}
