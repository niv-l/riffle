document.addEventListener('DOMContentLoaded', () => {
    const themeRadios = document.querySelectorAll('input[name="theme"]');
    const fontSizeSlider = document.getElementById('fontSize');
    const fontSizeValueSpan = document.getElementById('fontSizeValue');
    const focusSearchCheckbox = document.getElementById('focusSearch');
    const scrollBehaviorRadios = document.querySelectorAll('input[name="scrollBehavior"]');
    const customCSSTextarea = document.getElementById('customCSS');
    const saveCssButton = document.getElementById('saveCssButton');

    const settingsToLoad = ['theme', 'fontSize', 'focusSearch', 'customCSS', 'scrollBehavior'];

    // --- Load saved settings ---
    chrome.storage.sync.get(settingsToLoad, (result) => {
        // Theme
        const savedTheme = result.theme || 'system';
        themeRadios.forEach(radio => {
            radio.checked = (radio.value === savedTheme);
        });

        // Font Size
        const savedFontSize = result.fontSize || 15; // Default 15px
        fontSizeSlider.value = savedFontSize;
        fontSizeValueSpan.textContent = `${savedFontSize}px`;

        // Focus Search
        const savedFocusSearch = result.focusSearch === undefined ? true : result.focusSearch; // Default true
        focusSearchCheckbox.checked = savedFocusSearch;

        // Scroll Behavior
        const savedScrollBehavior = result.scrollBehavior || 'smooth'; // Default smooth
        scrollBehaviorRadios.forEach(radio => {
            radio.checked = (radio.value === savedScrollBehavior);
        });

        // Custom CSS
        customCSSTextarea.value = result.customCSS || '';
    });

    // --- Event Listeners ---

    // Theme
    themeRadios.forEach(radio => {
        radio.addEventListener('change', (event) => {
            if (event.target.checked) {
                chrome.storage.sync.set({ theme: event.target.value });
            }
        });
    });

    // Font Size
    fontSizeSlider.addEventListener('input', (event) => {
        const newSize = event.target.value;
        fontSizeValueSpan.textContent = `${newSize}px`;
        // Save dynamically on input for instant feedback preview
        chrome.storage.sync.set({ fontSize: parseInt(newSize, 10) });
    });

    // Focus Search
    focusSearchCheckbox.addEventListener('change', (event) => {
        chrome.storage.sync.set({ focusSearch: event.target.checked });
    });

    // Scroll Behavior
    scrollBehaviorRadios.forEach(radio => {
        radio.addEventListener('change', (event) => {
            if (event.target.checked) {
                chrome.storage.sync.set({ scrollBehavior: event.target.value });
            }
        });
    });

    // Custom CSS (Save on button click)
    saveCssButton.addEventListener('click', () => {
        chrome.storage.sync.set({ customCSS: customCSSTextarea.value }, () => {
            saveCssButton.textContent = 'Applied!';
            setTimeout(() => { saveCssButton.textContent = 'Apply CSS'; }, 1500);
        });
    });

});
