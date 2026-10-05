/**
 * Godot Engine Wrapper for Web - Loads Godot in background
 * while using web version's HTML/CSS/UI system
 */

const GODOT_WRAPPER = {
    engine: null,
    canvas: null,
    
    init() {
        this.canvas = document.getElementById('world');
        
        // Load Godot WASM in background but keep it hidden initially
        console.log('🌲 Loading Godot engine...');
        
        // Wait for page to load, then load Godot silently
        setTimeout(() => {
            this.loadGodotEngine();
        }, 100);
        
        // Import and run web version's game logic AFTER DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.initGameLogic();
            });
        } else {
            this.initGameLogic();
        }
    },
    
    async loadGodotEngine() {
        try {
            const response = await fetch('index.js');
            if (!response.ok) throw new Error('Failed to load Godot JS');
            
            // Inject Godot code
            const godotCode = await response.text();
            const script = document.createElement('script');
            script.textContent = godotCode;
            document.head.appendChild(script);
            
            console.log('✅ Godot engine loaded');
            
            // Once Godot is running, we can optionally hide it
            // and use our HTML overlays on top
            setTimeout(() => {
                this.setupOverlayMode();
            }, 2000);
            
        } catch (err) {
            console.error('❌ Failed to load Godot:', err);
        }
    },
    
    setupOverlayMode() {
        // Make sure our canvas is positioned correctly over Godot canvas
        // Hide the default Godot loading screen
        const statusOverlay = document.getElementById('status');
        if (statusOverlay) {
            statusOverlay.style.display = 'none';
        }
        
        // Ensure our canvas has proper z-index
        const gameCanvas = document.getElementById('world');
        if (gameCanvas) {
            gameCanvas.style.position = 'absolute';
            gameCanvas.style.top = '0';
            gameCanvas.style.left = '0';
            gameCanvas.style.zIndex = '1';
        }
        
        console.log('✅ Overlay mode active - using web version UI on top of Godot');
    },
    
    initGameLogic() {
        // Now inject the actual game code from web version
        // We need to do this dynamically since we're loading Godot
        
        const script = document.createElement('script');
        script.src = 'game.js?v=godot-1';
        document.body.appendChild(script);
        
        console.log('🌲 Game logic initialized');
        
        // After game loads, make sure Godot doesn't interfere
        setTimeout(() => {
            this.verifySetup();
        }, 500);
    },
    
    verifySetup() {
        const canvas = document.getElementById('world');
        if (canvas && canvas.getContext) {
            console.log('✅ Canvas ready for game rendering');
            
            // Check if Godot has initialized its canvas
            const godotCanvas = document.getElementById('canvas');
            if (godotCanvas) {
                console.log('ℹ️  Godot canvas detected:', godotCanvas.offsetWidth, 'x', godotCanvas.offsetHeight);
                
                // If Godot wants full control, hide it and show ours
                // Or layer them appropriately
                if (window.GodotBridge) {
                    window.GodotBridge.setupOverlayMode();
                }
            }
        }
    }
};

// Also inject Godot's HTML configuration
(function() {
    // Override the default Godot initialization
    window.INJECT_GODOT_HTML = false;
})();

// Initialize when ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        GODOT_WRAPPER.init();
    });
} else {
    GODOT_WRAPPER.init();
}

console.log('🌲 Godot Wrapper for Windhill Pawn RPG initialized');
