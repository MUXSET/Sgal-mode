(function () {
    // ==========================================
    // 0. 全局变量 & 状态管理
    // ==========================================
    let playList = [];
    let playIndex = 0;
    let maxPlayIndex = 0;

    const SAVE_KEY_PREFIX = 'gal_save_';
    const AUTO_SAVE_KEY_PREFIX = 'gal_autosave_';

    let characterAvatarUrl = null;

    // 打字机核心状态
    let typewriterEnabled = true;
    let typewriterSpeed = 50;
    let typewriterTimer = null;
    let isTyping = false;
    let currentDisplayedTextLength = 0; // 当前已显示在屏幕上的字数
    let currentTypingText = ''; // 当前正在打字的完整文本 (用于流式对比)

    // 流式传输状态
    let isStreaming = false;
    let streamingMsgId = null;
    let streamingHistorySnapshot = []; // 用于保存流式开始前的历史帧

    // SillyTavern 接口引用
    let eventSource = null;
    let event_types = null;

    // 字体设置
    let currentFontSize = 26;

    // ==========================================
    // 1. 界面 HTML (保持不变，略微优化结构)
    // ==========================================
    const galHtml = `
        <div id="gal-overlay">
            <div id="gal-bg-blur"></div>
            <div id="gal-bg-layer"></div>
            
            <div id="gal-progress" title="当前页数 / 总页数">1/1</div>

            <div id="gal-controls">
                <button id="gal-history-btn" class="gal-btn" title="Backlog">📜</button>
                <button id="gal-settings-btn" class="gal-btn" title="Config">⚙️</button>
                <button id="gal-save-btn" class="gal-btn" title="Save">💾</button>
                <button id="gal-load-btn" class="gal-btn" title="Load">📂</button>
                <button id="gal-back-btn" class="gal-btn" title="Back">⬅️</button>
                <button id="gal-close-btn" class="gal-btn" title="Exit">❌</button>
            </div>

            <!-- 设置菜单 -->
            <div id="gal-settings-menu">
                <div class="gal-setting-item">
                    <label class="gal-setting-label">Typewriter Effect</label>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <input type="checkbox" id="gal-typewriter-toggle" checked style="cursor:pointer;">
                        <span style="font-size:12px; color:#aaa;">ON</span>
                    </div>
                </div>
                <div class="gal-setting-item">
                    <label class="gal-setting-label">Text Speed</label>
                    <input type="range" min="10" max="100" value="50" class="gal-slider" id="gal-typewriter-speed">
                    <div style="text-align:center; font-size:11px; color:#888; margin-top:5px;">
                        <span id="gal-speed-value">50</span> ms
                    </div>
                </div>
                <div class="gal-setting-item">
                    <label class="gal-setting-label">Font Size</label>
                    <input type="range" min="18" max="60" value="${currentFontSize}" class="gal-slider" id="gal-font-slider">
                </div>
            </div>

            <!-- 存档/读档/历史菜单 省略，保持原样... -->
            <div id="gal-save-menu" class="gal-modal"><div class="gal-modal-content"><h3 id="gal-save-title">Save</h3><div id="gal-save-slots"></div><button class="gal-modal-close">Close</button></div></div>
            <div id="gal-history-menu" class="gal-modal"><div class="gal-modal-content"><h3>Backlog</h3><div id="gal-history-content"></div><button class="gal-modal-close">Close</button></div></div>
            <div id="gal-character-selector" class="gal-modal"><div class="gal-modal-content"><h3>Select Cartridge</h3><div id="gal-character-grid"></div><button class="gal-modal-close">Close</button></div></div>

            <div id="gal-dialogue-box">
                <div id="gal-name-tag">System</div>
                <div id="gal-text-content" style="font-size: ${currentFontSize}px"></div>
                <div id="gal-next-indicator"></div>
            </div>

            <!-- 继续按钮 -->
            <div id="gal-continue-container" style="display: none;">
                <button id="gal-continue-btn" class="gal-action-btn">▶ Continue</button>
            </div>
        </div>
    `;

    // ==========================================
    // 2. 核心解析逻辑 (解析单条消息)
    // ==========================================

    // 简单的文本清理
    function cleanText(text) {
        if (!text) return "";
        return text
            .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '') // 移除 CoT 思维链
            .replace(/<\/?(image)[^>]*>/gi, '') // 移除 image 标记本身
            .trim();
    }

    // 将单条消息解析为多个 GAL 帧 (Frames)
    // 这是实现 <image> 分页的关键
    function parseMessageToFrames(rawText, baseAvatar, characterName, isUser) {
        if (!rawText) return [];

        // 预处理：将 <br> 换行符转为 \n 以便统一处理
        let text = rawText.replace(/<br\s*\/?>/gi, '\n');

        // 按照用户约定的 <image> 标签进行分割
        // 分割后，数组偶数位是文本，奇数位是 <image> 标签(虽然 split 会丢弃分隔符，但我们可以用带捕获组的正则保留)
        // 这里简化逻辑：直接按 <image> 切分
        const parts = text.split(/<image\s*\/?>/i);

        const frames = [];
        let currentImg = baseAvatar; // 初始背景图

        parts.forEach(part => {
            let cleanPart = cleanText(part);
            if (cleanPart.length > 0) {
                // 处理对话中的名字前缀 (e.g. "Alice: Hello")
                let frameName = isUser ? "You" : characterName;
                let frameText = cleanPart;

                // 简单的正则匹配名字 "Name: Text"
                const nameMatch = cleanPart.match(/^([^:：\n]{1,20})[:：]\s*(.*)/s);
                if (nameMatch) {
                    frameName = nameMatch[1].trim();
                    frameText = nameMatch[2].trim();
                    // 去除首尾的引号
                    if (frameText.startsWith('"') && frameText.endsWith('"')) frameText = frameText.slice(1, -1);
                    if (frameText.startsWith('「') && frameText.endsWith('」')) frameText = frameText.slice(1, -1);
                }

                frames.push({
                    text: frameText,
                    img: currentImg,
                    name: frameName,
                    isUser: isUser,
                    rawLength: cleanPart.length // 用于判断是否发生变化
                });
            }
            // 注意：如果 prompt 里的 <image> 实际上是想换图，
            // 这里需要额外的逻辑去解析图片 URL。
            // 但根据你的 prompt，<image> 只是一个标记，通常意味着“状态改变”或“使用当前附件”。
            // 由于 ST 的流式传输不一定能实时拿到附件 URL，这里暂且沿用上一张图。
            // 如果你有提取附件的逻辑，可以在这里添加。
        });

        return frames;
    }

    // ==========================================
    // 3. 渲染与打字机 (核心修改点)
    // ==========================================

    function renderFrame(forceFullDisplay = false) {
        if (!playList || playList.length === 0) return;

        // 边界检查
        if (playIndex >= playList.length) playIndex = playList.length - 1;
        if (playIndex < 0) playIndex = 0;

        const frame = playList[playIndex];
        const textElement = $('#gal-text-content');
        const nameElement = $('#gal-name-tag');
        const bgLayer = $('#gal-bg-layer');
        const bgBlur = $('#gal-bg-blur');

        // 1. 设置背景 (只有变化时才操作 DOM，减少闪烁)
        if (frame.img) {
            const currentBg = bgLayer.css('background-image');
            if (!currentBg.includes(encodeURI(frame.img))) {
                const url = `url("${frame.img}")`;
                bgLayer.css('background-image', url);
                bgBlur.css('background-image', url);
            }
        }

        // 2. 设置名字
        nameElement.text(frame.name || "");
        // 根据名字设置颜色 (简单哈希或固定颜色)
        const nameColor = frame.isUser ? '#00d2ff' : '#ff0088'; // 简单示例
        nameElement.css('color', nameColor);

        // 3. 设置进度
        $('#gal-progress').text(`${playIndex + 1}/${playList.length}`);

        // 4. 处理文本渲染 (打字机逻辑)
        const targetText = frame.text || "";

        // 如果强制完全显示（例如用户点击了屏幕，或者翻看历史记录）
        if (forceFullDisplay || !typewriterEnabled) {
            clearInterval(typewriterTimer);
            typewriterTimer = null;
            isTyping = false;
            textElement.html(targetText.replace(/\n/g, '<br>'));
            currentDisplayedTextLength = targetText.length;
            updateNextIndicator();
            return;
        }

        // 如果已经在打字，并且内容变长了（流式传输中），不重置，只继续打
        if (isTyping && textElement.text() !== targetText) {
            // 保持定时器运行，不需要做任何事，定时器回调里会处理
        } else if (!isTyping) {
            // 开始新的打字效果
            startTypewriter(targetText);
        }
    }

    function startTypewriter(fullText) {
        if (typewriterTimer) clearInterval(typewriterTimer);
        isTyping = true;
        const textElement = $('#gal-text-content');

        // 如果是流式传输且当前页之前已经打过一部分，不要从头开始
        // 但为了简单起见，每次页面切换我们都重置 currentDisplayedTextLength = 0
        // 只有在同一页追加内容时才保留
        if (playIndex !== parseInt(textElement.attr('data-page-index'))) {
            currentDisplayedTextLength = 0;
            textElement.html('');
            textElement.attr('data-page-index', playIndex);
        }

        $('#gal-next-indicator').removeClass('visible');

        typewriterTimer = setInterval(() => {
            const currentFrame = playList[playIndex];
            if (!currentFrame) return; // 防御性编程

            const targetText = currentFrame.text; // 获取最新的文本（流式传输时会变长）

            if (currentDisplayedTextLength < targetText.length) {
                currentDisplayedTextLength++;
                const subStr = targetText.substring(0, currentDisplayedTextLength);
                textElement.html(subStr.replace(/\n/g, '<br>'));

                // 自动滚动到底部 (如果文本框溢出)
                const box = document.getElementById('gal-dialogue-box');
                if (box) box.scrollTop = box.scrollHeight;
            } else {
                // 暂时打完了，但如果是流式传输中，不要设为 isTyping=false，因为马上还有新字
                if (!isStreaming) {
                    isTyping = false;
                    clearInterval(typewriterTimer);
                    typewriterTimer = null;
                    updateNextIndicator();
                }
            }
        }, typewriterSpeed);
    }

    function updateNextIndicator() {
        // 只有在非打字状态，且 (不是最后一页 OR 是最后一页但流式传输已结束) 才显示箭头
        if (!isTyping) {
            if (playIndex < playList.length - 1) {
                $('#gal-next-indicator').addClass('visible');
            } else if (!isStreaming) {
                // 流式结束，且是最后一页
                $('#gal-next-indicator').addClass('visible');
                // 这里可以触发显示“Continue”按钮的逻辑
                if (playIndex === playList.length - 1) {
                    $('#gal-continue-container').fadeIn();
                }
            }
        } else {
            $('#gal-next-indicator').removeClass('visible');
        }
    }

    // ==========================================
    // 4. 流式传输监听 (SillyTavern 接口对接)
    // ==========================================

    function initEventSystem() {
        if (window.SillyTavern && window.SillyTavern.eventSource) {
            eventSource = window.SillyTavern.eventSource;
            event_types = window.SillyTavern.event_types;
            console.log('[GAL] Event system hooked.');

            // 监听生成开始
            eventSource.on(event_types.GENERATION_STARTED, onGenerationStarted);
            // 监听 Token 接收
            eventSource.on(event_types.STREAM_TOKEN_RECEIVED, onTokenReceived);
            // 监听生成结束 (包括完成、停止、出错)
            eventSource.on(event_types.GENERATION_ENDED, onGenerationEnded);
            eventSource.on(event_types.GENERATION_STOPPED, onGenerationEnded);
        } else {
            console.warn('[GAL] SillyTavern event system not found. Retrying in 1s...');
            setTimeout(initEventSystem, 1000);
        }
    }

    function onGenerationStarted(type) {
        console.log('[GAL] Stream Started');
        isStreaming = true;

        // 隐藏 Continue 按钮
        $('#gal-continue-container').hide();

        // 锁定当前历史记录，防止重建整个列表导致闪烁
        // 我们只操作 playList 的末尾
        const context = window.SillyTavern.getContext();
        streamingMsgId = context.chat.length; // 预估的新消息ID（通常是最后一条+1，或者如果是重新生成则是最后一条）

        // 如果是重新生成，我们需要切除 playList 中属于旧回复的部分
        // 这里简化处理：我们假设用户点击继续后，SillyTavern 会追加一条新消息
        // 此时 playList 应该保留当前所有内容。

        // 关键点：记录流式生成开始时 playList 的长度
        // 新生成的帧将从这里开始追加
        streamingHistorySnapshot = [...playList];

        // 自动翻到最后一页准备接收新内容
        if (playIndex !== playList.length - 1) {
            playIndex = playList.length - 1;
        }
    }

    function updateStreamingContent(msgId, isFinal = false) {
        const context = window.SillyTavern.getContext();
        const chatLog = context.chat;
        if (!chatLog || !chatLog[msgId]) return;

        const activeMsg = chatLog[msgId];
        if (activeMsg.is_user) return;

        // Get avatar (background)
        const charId = context.characterId;
        const charAvatar = context.characters[charId] ? context.characters[charId].avatar : null;
        const avatarUrl = charAvatar ? `/thumbnail?type=avatar&file=${encodeURIComponent(charAvatar)}` : 'img/ai4.png';

        // Parse frames
        // We use the existing parseMessageToFrames which handles <image> splitting
        const newFrames = parseMessageToFrames(activeMsg.mes, avatarUrl, activeMsg.name, false);

        // Update Playlist
        // Always replace from streamingStartIndex
        if (newFrames.length > 0 || isFinal) {
            const oldHistory = playList.slice(0, streamingStartIndex);
            playList = oldHistory.concat(newFrames);
        }

        // Update State
        const totalFrames = playList.length;
        maxPlayIndex = totalFrames - 1;
        $('#gal-progress').text(`${playIndex + 1}/${totalFrames}`);

        // View Update Logic
        if (playIndex < streamingStartIndex) {
            $('#gal-next-indicator').addClass('visible');
            return;
        }

        // Clamp playIndex
        if (playIndex > maxPlayIndex) {
            playIndex = maxPlayIndex;
        }

        const currentFrame = playList[playIndex];
        if (currentFrame) {
            // Real-time text update
            if (currentTypingText !== currentFrame.text) {
                currentTypingText = currentFrame.text;

                // Stop typewriter if running
                if (typewriterTimer) {
                    clearInterval(typewriterTimer);
                    typewriterTimer = null;
                }
                isTyping = false;

                // Direct HTML update
                $('#gal-text-content').html(currentTypingText.replace(/\n/g, '<br>'));
            }

            // Real-time background update
            if (currentFrame.img) {
                const targetUrl = `url("${currentFrame.img}")`;
                const currentUrl = $('#gal-bg-layer').css('background-image');
                if (!currentUrl || (!currentUrl.includes(encodeURI(currentFrame.img)) && !currentUrl.includes(currentFrame.img))) {
                    $('#gal-bg-layer').css('background-image', targetUrl);
                    $('#gal-bg-blur').css('background-image', targetUrl);
                }
            }
        }

        // Next Indicator
        if (playIndex < maxPlayIndex) {
            $('#gal-next-indicator').addClass('visible');
        } else {
            $('#gal-next-indicator').removeClass('visible');
        }
    }

    function onTokenReceived(token) {
        const context = window.SillyTavern.getContext();
        if (context.chat && context.chat.length > 0) {
            updateStreamingContent(context.chat.length - 1);
        }
    }

    function onGenerationEnded() {
        console.log('[GAL] Stream Ended');
        isStreaming = false;
        const context = window.SillyTavern.getContext();
        if (context.chat && context.chat.length > 0) {
            updateStreamingContent(context.chat.length - 1, true);
        } else {
            renderFrame();
        }
    }

    // ==========================================
    // 5. 辅助功能 (获取头像等)
    // ==========================================
    function getCharacterAvatar() {
        // ... (使用你原来代码里的逻辑，或者上面的简化逻辑) ...
        // 这里为了完整性保留一个简单的
        try {
            const context = window.SillyTavern.getContext();
            if (context && context.characters && context.characterId !== undefined) {
                const char = context.characters[context.characterId];
                if (char && char.avatar) return `/thumbnail?type=avatar&file=${encodeURIComponent(char.avatar)}`;
            }
        } catch (e) { }
        return 'img/ai4.png';
    }

    // 加载所有历史消息构建初始 PlayList
    function loadAllMessages() {
        const msgs = document.querySelectorAll('.mes'); // 读取 DOM 还是 Chat 数组？
        // 建议读取 SillyTavern 的 Context.chat 数据源，比 DOM 更准确
        const context = window.SillyTavern.getContext();
        const chatLog = context.chat;

        playList = [];
        let lastBg = getCharacterAvatar();

        if (chatLog) {
            chatLog.forEach(msg => {
                // 排除系统提示等非对话内容（可选）
                if (msg.is_system) return;

                const frames = parseMessageToFrames(msg.mes, lastBg, msg.name, msg.is_user);
                if (frames.length > 0) {
                    playList.push(...frames);
                    lastBg = frames[frames.length - 1].img; // 延续背景
                }
            });
        }

        if (playList.length === 0) {
            playList.push({ text: "...", img: lastBg, name: "System", isUser: false });
        }

        maxPlayIndex = playList.length - 1;
        playIndex = maxPlayIndex; // 默认跳到最新
        renderFrame(true); // 初始加载直接显示，不打字
    }

    // ==========================================
    // 6. 初始化与事件绑定
    // ==========================================

    function continueStory() {
        // 触发 SillyTavern 的生成
        // 这里模拟点击发送按钮或者调用 API
        const sendBtn = $('#send_but');
        if (sendBtn.length) {
            $('#gal-continue-container').fadeOut();
            // 清空输入框以触发“继续”
            $('#send_textarea').val('');
            sendBtn.click();
        }
    }

    function init() {
        if ($('#gal-overlay').length === 0) $('body').append(galHtml);

        initEventSystem();

        // 绑定点击事件 (Strict Manual Pagination)
        $('#gal-overlay').off('click').on('click', function (e) {
            // 排除 UI 控件点击
            if ($(e.target).closest('.gal-btn, .gal-modal, #gal-controls, #gal-settings-menu, .gal-title-btn, .gal-action-btn, #gal-choice-container').length > 0) return;
            if ($('body').hasClass('gal-title-active')) return;

            // 排除菜单打开状态
            if ($('#gal-settings-menu').hasClass('active') || $('#gal-save-menu').hasClass('active') || $('#gal-history-menu').hasClass('active')) {
                $('.gal-modal').removeClass('active');
                $('#gal-settings-menu').removeClass('active');
                return;
            }

            // 排除选中文本
            if (window.getSelection().toString().length > 0) return;

            // 1. 如果正在打字，点击瞬间完成打字 (Skip Typewriter)
            if (isTyping) {
                renderFrame(true); // 强制完成
                return;
            }

            // 2. 核心翻页逻辑
            if (playIndex < maxPlayIndex) {
                // 有下一页（无论是历史记录，还是刚刚流式生成出来的缓存页） -> 翻页
                playIndex++;
                renderFrame(); // 渲染新的一页
            } else {
                // 3. 已经是最后一页了
                // 检查是否流式传输意外停止了但没有触发完成事件 (手动触发更新以防万一)
                const context = window.SillyTavern.getContext();
                const sendBtn = $('#send_but');
                const isGenerating = !sendBtn.is(':visible');

                if (isGenerating && context.chat) {
                    // 尝试手动触发一次更新
                    // onTokenReceived(null); // 或者不做任何事，等待流式结束
                }
            }
        });

        $('#gal-continue-btn').click((e) => {
            e.stopPropagation();
            continueStory();
        });

        $('#gal-back-btn').click((e) => {
            e.stopPropagation();
            if (playIndex > 0) {
                playIndex--;
                renderFrame(true); // 回看时不打字
            }
        });

        // 初始化入口按钮
        if ($('#activate-gal').length === 0) {
            const btn = $('<button id="activate-gal">📺 GAL Mode</button>');
            $('body').append(btn);
            btn.click(() => {
                $('body').addClass('gal-mode-active');
                loadAllMessages();
            });
        }

        // 关闭按钮
        $('#gal-close-btn').click(() => {
            $('body').removeClass('gal-mode-active');
        });

        // 其他设置面板、滑块等事件绑定同你之前的代码，这里略过以节省篇幅
        $('#gal-typewriter-speed').on('input', function () {
            typewriterSpeed = parseInt($(this).val());
            $('#gal-speed-value').text(typewriterSpeed);
        });
    }

    $(document).ready(() => setTimeout(init, 2000)); // 延迟等待 ST 加载
})();
