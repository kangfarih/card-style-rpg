/**
 * Godot Game Bridge - Connects HTML DOM HUD with Godot Canvas
 * Enables the same UI overlay system from web version to work with Godot backend
 */

const GODOT_BRIDGE = {
    engine: null,
    canvas: null,
    initialized: false,
    
    // DOM Elements
    elements: {},
    
    init() {
        this.canvas = document.getElementById('world');
        if (!this.canvas) {
            console.error('Godot canvas not found!');
            return;
        }
        
        // Cache DOM elements
        this.cacheElements();
        
        // Setup event handlers
        this.setupEventListeners();
        
        // Setup resize handling
        this.setupResize();
        
        this.initialized = true;
        console.log('🌲 Godot Bridge initialized successfully');
    },
    
    cacheElements() {
        const ids = [
            'character', 'config', 'pause', 
            'goldvalue', 'itemvalue',
            'hptext', 'mptext', 'hpbar', 'mpbar',
            'cardhp', 'cardmp', 'cardhpbar', 'cardmpbar',
            'kills', 'expbar', 'exptext',
            'coords', 'autohunt', 'notice', 'overlay'
        ];
        
        ids.forEach(id => {
            this.elements[id] = document.getElementById(id);
        });
    },
    
    setupEventListeners() {
        // Pause button handler
        const pauseBtn = document.getElementById('pause');
        if (pauseBtn) {
            pauseBtn.addEventListener('click', () => {
                this.togglePause();
            });
        }
        
        // Character card toggle
        const charBtn = document.getElementById('character');
        if (charBtn) {
            charBtn.addEventListener('click', () => {
                this.toggleCharacterCard();
            });
        }
        
        // Config menu
        const configBtn = document.getElementById('config');
        if (configBtn) {
            configBtn.addEventListener('click', () => {
                this.openConfig();
            });
        }
        
        // Skill buttons - send to Godot
        document.querySelectorAll('.skills button').forEach(btn => {
            btn.addEventListener('click', () => {
                const skill = btn.dataset.skill;
                this.sendSkillToGodot(skill);
            });
        });
        
        // Auto hunt toggle
        const autoHunt = document.getElementById('autohunt');
        if (autoHunt) {
            autoHunt.addEventListener('click', () => {
                const isOn = autoHunt.getAttribute('aria-pressed') === 'true';
                autoHunt.setAttribute('aria-pressed', !isOn);
                this.sendAutoHuntToggle(!isOn);
            });
        }
        
        // Restart
        const resetBtn = document.getElementById('reset');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.restartGame();
            });
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            switch(e.code) {
                case 'Space':
                    e.preventDefault();
                    this.sendAttackToGodot();
                    break;
                case 'Digit1':
                    this.sendSkillToGodot('attack');
                    break;
                case 'Digit2':
                    this.sendSkillToGodot('fire');
                    break;
                case 'Digit3':
                    this.sendSkillToGodot('heal');
                    break;
                case 'Escape':
                    this.toggleCharacterCard();
                    break;
                case 'KeyP':
                    this.togglePause();
                    break;
            }
        });
    },
    
    setupResize() {
        // Ensure canvas maintains aspect ratio
        const updateCanvasSize = () => {
            const container = this.canvas.parentElement;
            if (container) {
                // Godot expects 390x693
                this.canvas.width = 390;
                this.canvas.height = 693;
            }
        };
        
        window.addEventListener('resize', updateCanvasSize);
        updateCanvasSize();
    },
    
    // Game State Sync Methods
    
    syncGameState(gameState) {
        if (!gameState) return;
        
        // Update HP
        if (this.elements.hptext && gameState.hp !== undefined) {
            this.elements.hptext.textContent = `${Math.floor(gameState.hp)} / ${Math.floor(gameState.maxHp || 240)}`;
        }
        if (this.elements.mptext && gameState.mp !== undefined) {
            this.elements.mptext.textContent = `${Math.floor(gameState.mp)} / ${Math.floor(gameState.maxMp || 100)}`;
        }
        
        // Update gold and items
        if (this.elements.goldvalue && gameState.gold !== undefined) {
            this.elements.goldvalue.textContent = gameState.gold;
        }
        if (this.elements.itemvalue && gameState.items !== undefined) {
            this.elements.itemvalue.textContent = gameState.items;
        }
        
        // Update XP
        if (this.elements.exptext && gameState.exp !== undefined) {
            this.elements.exptext.textContent = `EXP ${gameState.exp} / ${gameState.maxExp || 100}`;
        }
        
        // Update kills for quest
        if (this.elements.kills && gameState.kills !== undefined) {
            this.elements.kills.textContent = `${gameState.kills}/5`;
        }
        
        // Update coordinates
        if (this.elements.coords && gameState.position) {
            const [x, y] = gameState.position;
            this.elements.coords.textContent = `GROVE · ${x}, ${y}`;
        }
        
        // Level update
        if (this.elements.levelvalue && gameState.level !== undefined) {
            this.elements.levelvalue.textContent = `Lv. ${gameState.level}`;
        }
    },
    
    // Action Handlers - Send commands to Godot
    
    sendSkillToGodot(skillName) {
        if (window.postMessage && this.canvas) {
            this.canvas.dispatchEvent(new CustomEvent('godot_skill', {
                detail: { skill: skillName }
            }));
        }
    },
    
    sendAttackToGodot() {
        if (window.postMessage && this.canvas) {
            this.canvas.dispatchEvent(new CustomEvent('godot_attack', {}));
        }
    },
    
    sendAutoHuntToggle(enabled) {
        if (window.postMessage && this.canvas) {
            this.canvas.dispatchEvent(new CustomEvent('godot_aut Hunt', {
                detail: { enabled: enabled }
            }));
        }
    },
    
    togglePause() {
        const overlay = document.getElementById('overlay');
        if (overlay) {
            const isPaused = !overlay.hidden;
            overlay.hidden = !isPaused;
            overlay.querySelector('#overlaytitle').textContent = isPaused ? 'Paused' : 'Resume';
            
            if (window.postMessage) {
                this.canvas.dispatchEvent(new CustomEvent('godot_pause', {
                    detail: { paused: isPaused }
                }));
            }
        }
    },
    
    toggleCharacterCard() {
        const dialog = document.getElementById('characterdialog');
        if (dialog) {
            const isOpen = dialog.open;
            if (isOpen) {
                dialog.close();
            } else {
                dialog.showModal();
                
                // If in Godot mode, you might want to pause game here
                // This depends on how you've set up Godot to respond to events
            }
        }
    },
    
    openConfig() {
        const dialog = document.getElementById('configdialog');
        if (dialog) {
            dialog.showModal();
        }
    },
    
    restartGame() {
        if (window.postMessage && this.canvas) {
            this.canvas.dispatchEvent(new CustomEvent('godot_restart', {}));
        }
        
        // Reload page
        window.location.reload();
    },
    
    // Message Handler
    handleMessage(event) {
        if (event.data && event.data.type === 'GODOT_GAMESTATE') {
            this.syncGameState(event.data.state);
        }
    }
};

// Listen for messages from Godot
if (window.addEventListener) {
    window.addEventListener('message', (e) => {
        GODOT_BRIDGE.handleMessage(e);
    });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => GODOT_BRIDGE.init(), 100);
    });
} else {
    setTimeout(() => GODOT_BRIDGE.init(), 100);
}

// Export for use by game.js
window.GodotBridge = GODOT_BRIDGE;
