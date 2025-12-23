# Sgal-mode 🎮

SillyTavern GAL Mode - 视觉小说风格界面扩展

**将 SillyTavern 的聊天界面转换为 Galgame（视觉小说）风格的沉浸式体验。**

![License](https://img.shields.io/badge/license-MIT-blue.svg)

## ✨ 特性

- 🎬 **视觉小说式界面** - 全屏背景、对话框、角色立绘
- ⌨️ **打字机效果** - 可调速度的文字显示动画
- 💾 **存档系统** - 4个存档槽位，支持保存/读取进度
- 📖 **历史记录** - 查看之前的对话内容
- 🎯 **选项系统** - 自动检测并渲染选项按钮
- ▶️ **Continue Story** - 一键继续故事生成
- 🔄 **流式传输支持** - 实时显示 AI 生成内容
- 🎨 **自定义设置** - 字体大小、打字速度等

## 📦 安装

1. 下载此仓库到 SillyTavern 的 `extensions` 目录：
   ```bash
   cd SillyTavern/public/scripts/extensions/third-party
   git clone https://github.com/MUXSET/Sgal-mode.git
   ```

2. 重启 SillyTavern

3. 点击界面上的 "📺 GAL Mode" 按钮启动

## 🎮 使用方法

### 基本操作
- **点击屏幕** - 翻到下一页
- **Continue Story** - 让 AI 继续生成内容
- **选择选项** - 点击显示的选项按钮

### 控制按钮
| 按钮 | 功能 |
|------|------|
| 📜 | 查看历史记录 |
| ⚙️ | 设置菜单 |
| 💾 | 保存游戏 |
| 📂 | 读取存档 |
| ⬅️ | 返回上一句 |
| ⏮️ | 重新开始 |
| 🔄 | 同步消息 |
| ❌ | 退出 GAL 模式 |

## 🔧 配置

在设置菜单中可调整：
- 打字机效果开关
- 打字速度（10-100 ms/字）
- 字体大小（18-60 px）

## 📝 更新日志

### 2024-12-24
- ✅ 修复 Continue 按钮点击后回跳问题
- ✅ 修复点击屏幕导致帧数翻倍问题
- ✅ 新增加载指示器（Generating 动画）
- ✅ 新增思维链 `<thinking>` 标签检测
- ✅ 修复存档菜单显示问题

详见 [CHANGELOG_20241224.md](CHANGELOG_20241224.md)

## 🏗️ 项目结构

```
Sgal-mode/
├── src/
│   ├── adapters/        # SillyTavern API 适配器
│   ├── controllers/     # 流程控制器
│   ├── core/           # 核心引擎（播放列表、打字机）
│   ├── services/       # 服务（存档、图片）
│   └── ui/             # UI 组件
├── style.css           # 样式
├── index.js            # 入口（兼容模式）
└── manifest.json       # 扩展配置
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 License

MIT License
