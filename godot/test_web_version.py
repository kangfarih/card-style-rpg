from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    # Navigate to web version
    page.goto("http://localhost:8081", wait_until="networkidle")
    
    # Get canvas info
    canvas_info = page.evaluate("""() => {
        const canvas = document.getElementById('world');
        return {
            width: canvas.width,
            height: canvas.height,
            viewportWidth: canvas.clientWidth,
            viewportHeight: canvas.clientHeight
        };
    }""")
    
    print(f"WEB VERSION - Canvas Info:")
    print(f"  Width: {canvas_info['width']}")
    print(f"  Height: {canvas_info['height']}")
    print(f"  Viewport Width: {canvas_info['viewportWidth']}")
    print(f"  Viewport Height: {canvas_info['viewportHeight']}")
    
    # Get title
    title = page.title()
    print(f"\nTitle: {title}")
    
    # Take screenshot
    page.screenshot(path='web_version_start.png', full_page=True)
    print("\nScreenshot saved: web_version_start.png")
    
    browser.close()
