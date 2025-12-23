/**
 * main.js
 * Entry point for Sgal-mode Galgame plugin (Modular Architecture V8.0)
 * Bootstraps application and wires all dependencies
 */

// Core Imports
import { StateManager } from './core/StateManager.js';
import { PlaylistEngine } from './core/PlaylistEngine.js';
import { TypewriterEngine } from './core/TypewriterEngine.js';

// Adapter Imports
import { STAdapter } from './adapters/STAdapter.js';
import { STEventHandler } from './adapters/STEventHandler.js';
import { STCharacterManager } from './adapters/STCharacterManager.js';

// Service Imports
import { SaveManager } from './services/SaveManager.js';
import { LocalStorageService } from './services/LocalStorageService.js';
import { ImageService } from './services/ImageService.js';

// UI Component Imports
import { DialogueBox } from './ui/components/DialogueBox.js';
import { ControlPanel } from './ui/components/ControlPanel.js';
import { SettingsMenu } from './ui/components/SettingsMenu.js';
import { ChoiceSystem } from './ui/components/ChoiceSystem.js';
import { HistoryMenu } from './ui/components/HistoryMenu.js';
import { SaveLoadMenu } from './ui/components/SaveLoadMenu.js';
import { TitleScreen } from './ui/components/TitleScreen.js';
import { UIManager } from './ui/UIManager.js';

// Controller Imports
import { ChoiceController } from './controllers/ChoiceController.js';
import { NavigationController } from './controllers/NavigationController.js';
import { GameFlowController } from './controllers/GameFlowController.js';

/**
 * Initialize application
 */
function initializeGALMode() {
    console.log('[GAL] Initializing modular architecture...');

    // ========================================
    // Layer 1: Core Engine & State
    // ========================================
    const stateManager = new StateManager();
    const playlistEngine = new PlaylistEngine();
    const typewriterEngine = new TypewriterEngine(stateManager);

    // ========================================
    // Layer 2: SillyTavern Adapters
    // ========================================
    const stAdapter = new STAdapter();
    const stEventHandler = new STEventHandler(stateManager);
    const stCharacterManager = new STCharacterManager(stAdapter);

    // Initialize event system
    stEventHandler.initialize();

    // ========================================
    // Layer 3: Services
    // ========================================
    const saveManager = new SaveManager(stAdapter);
    const localStorageService = new LocalStorageService(stateManager);
    const imageService = new ImageService(stAdapter);

    // ========================================
    // Layer 4: UI Components
    // ========================================
    const dialogueBox = new DialogueBox(stateManager, typewriterEngine, imageService);
    const controlPanel = new ControlPanel();
    const settingsMenu = new SettingsMenu(stateManager);
    const choiceSystem = new ChoiceSystem();
    const historyMenu = new HistoryMenu(stateManager);
    // Updated: SaveLoadMenu only needs saveManager now
    const saveLoadMenu = new SaveLoadMenu(saveManager);
    const titleScreen = new TitleScreen(stAdapter, stCharacterManager, imageService);

    // ========================================
    // Layer 5: Controllers
    // ========================================
    const choiceController = new ChoiceController(stAdapter, choiceSystem);
    const navigationController = new NavigationController(stateManager, dialogueBox);

    const gameFlowController = new GameFlowController(
        stateManager,
        stAdapter,
        stEventHandler,
        playlistEngine,
        dialogueBox,
        choiceController,
        navigationController,
        choiceSystem,
        imageService,
        localStorageService
    );

    // ========================================
    // Layer 6: UI Manager (Top Level)
    // ========================================
    const uiManager = new UIManager(
        stateManager,
        {
            dialogueBox,
            controlPanel,
            settingsMenu,
            choiceSystem,
            historyMenu,
            saveLoadMenu,
            titleScreen,
            typewriter: typewriterEngine,
            imageService,
            characterManager: stCharacterManager
        },
        gameFlowController,
        navigationController
    );

    // Initialize UI
    uiManager.initialize();

    // Expose debug interface
    window.GAL_DEBUG = {
        state: stateManager,
        gameFlow: gameFlowController,
        navigation: navigationController,
        choice: choiceController,
        saveManager: saveManager, // Expose saveManager for debugging
        getPlayList: () => stateManager.playList,
        getPlayIndex: () => stateManager.playIndex,
        updateStreamingContent: (msgId) => gameFlowController.updateStreamingContent(msgId)
    };

    console.log('[GAL] ✅ Modular Architecture V8.0 initialized successfully!');
}

// ========================================
// Bootstrap on Document Ready
// ========================================
$(document).ready(() => {
    // Delay initialization to ensure SillyTavern is fully loaded
    setTimeout(() => {
        checkLoadState();
        initializeGALMode();
    }, 1500);
});

/**
 * 检查是否有从读档恢复的状态
 */
function checkLoadState() {
    const loadStateRaw = sessionStorage.getItem('GAL_LOAD_STATE');
    if (loadStateRaw) {
        try {
            const state = JSON.parse(loadStateRaw);
            console.log("[GAL] Restoring state from load:", state);

            // 这里我们假设 StateManager 实例可以通过某种方式访问，
            // 或者我们直接修改 window.GAL_DEBUG.state (如果已经初始化)
            // 但由于 initializeGALMode 还没跑完，我们可能需要把这个逻辑移到 initializeGALMode 内部
            // 或者暂时存到 window 变量里供 StateManager 初始化时读取

            // 更好的做法：把这个状态传给 StateManager
            window.GAL_PENDING_LOAD_STATE = state;

            // 清除标记
            sessionStorage.removeItem('GAL_LOAD_STATE');
        } catch (e) { console.error(e); }
    }
}
