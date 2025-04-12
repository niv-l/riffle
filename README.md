<p align="center"><img width="300" alt="The Riffle logo on a dark gray background. On the left is an icon composed of six stacked, horizontal bars with rounded corners; the top bar is thickest and a dark mauve-red color, while the five bars below it are thinner and show a gradient fading to a lighter mauve-pink at the bottom. To the right of the icon is the word 'riffle' in lowercase, using a thin, sans-serif font in the same dark mauve-red color as the top bar." src="https://niv.s-ul.eu/qWHNrF3U"></p>
<p align="center">Riffle is a browser extension that generates a searchable, keyboard-navigable outline derived from the page's heading elements.</p>

## Key Features

*   **Dynamic Outline Generation:** Creates a hierarchical view from visible `H1` through `H6` elements on the current page.
*   **Instant Fuzzy Search:** Quickly filter the outline by typing any part of a heading's text.
*   **Keyboard-Centric Navigation:** Designed for efficient use without requiring mouse interaction.
*   **Direct Page Navigation:** Select an item in the outline to scroll the corresponding heading into view.
*   **Hierarchical Control:** Expand and collapse individual branches or the entire outline structure.
*   **Customizable Interface:** Adjust theme (System, Light, Dark), font size, and apply custom CSS rules.
*   **Minimal Design:** Focuses on functionality with a clean user interface.

## Installation

Install Riffle from the Chrome Web Store (I will be updating this with a link shortly) or follow these steps to load the unpacked extension:

1.  Download or clone this repository.
2.  Open a Chromium Based Browser (Chrome, Brave, Vivaldi, etc.) and navigate to `chrome://extensions`.
3.  Enable "Developer mode" using the toggle switch (usually in the top right).
4.  Click "Load unpacked" and select the directory containing the extension's files (including `manifest.json`).

## Screenshots
### Pop Up
| Dark Mode                                                                                      | Light Mode                                                                                      |
| :-------------------------------------------------------------------------------------------: | :-------------------------------------------------------------------------------------------: |
| <img width="475" src="https://github.com/user-attachments/assets/fc40bacd-42a8-4dc3-aaf3-86260bf6a17b"> | <img width="475" src="https://github.com/user-attachments/assets/e23757e1-d000-4b0a-b207-38feb6257b1c"> |
| <img width="475" src="https://github.com/user-attachments/assets/770d12e8-8f05-4bcb-a336-22a4913545e0"> | <img width="475" src="https://github.com/user-attachments/assets/2e15ae58-8c02-48ac-9764-3747766e9613"> |

### Settings Menu
<p align="center">
  <img width="350" src="https://github.com/user-attachments/assets/91d3effe-4a84-4e28-88a7-6cb8ec4e673d">
</p>

## Usage

### Activating the Outline Panel

*   Press `Ctrl+Shift+Space` (Linux / Windows) or `MacCtrl+Shift+Space` (macOS).
*   *Note: You can customize this shortcut via your browser's extension keyboard shortcuts page (e.g., `chrome://extensions/shortcuts`).*

### Configuring Settings

Click the Riffle extension icon in your browser toolbar to access the settings popup, where you can adjust:

*   **Theme:** Choose between System default, Light, or Dark mode overrides.
*   **Font Size:** Modify the base font size for the outline panel.
*   **Auto-focus Search:** Determine if the search input should be focused automatically when the panel opens.
*   **Custom CSS:** Apply user-defined styles (see Customization section).

### Interacting with the Panel

Once the panel is open, use the following keyboard shortcuts:

**Navigation & Selection:**
*   `↑` / `↓`: Move selection up or down.
*   `Enter`: Scroll to the selected heading on the page and close the panel.
*   `Esc`: Close the panel without navigating.

**Search:**
*   *Start typing*: Instantly filters the outline based on your input.
*   `/`: Focus the search input field.

**Hierarchy Management:**
*   `→`: Expand the selected node (if collapsed) or move selection to its first visible child (if expanded).
*   `←`: Collapse the selected node (if expanded) or move selection to its parent node (if collapsed or a leaf node).
*   `Tab`: Toggle between showing only top-level headings (H1) and all headings. Clears any active search query.
*   *Click* `▶`/`▼`: Expand or collapse an individual node with the mouse.

## Customization via CSS

You can further tailor the appearance of the outline panel by adding your own CSS rules in the "Custom CSS" section of the settings popup. These styles are injected dynamically and target the main container element.

**Target Selector:** `#quick-outline-container`

**Example Custom CSS:**

```css
/* --- Example Riffle Custom CSS --- */

#quick-outline-container {
  /* Slightly wider panel */
  max-width: 650px;
  border: 1px solid var(--qo-border-color);
}

/* Change selection background and indicator color */
#quick-outline-container li.selected > .outline-item-wrapper {
  background-color: salmon; /* Salmon background */
}
#quick-outline-container li.selected::before {
    background-color: #ff7a7a; /* Brighter red indicator */
}

/* Style the heading number differently */
.outline-item-number {
  font-weight: bold;
  opacity: 0.6;
  min-width: 40px; /* Ensure alignment */
  margin-right: 12px;
}

/* Add subtle border to search input */
#quick-outline-container input[type="search"] {
    border-bottom: 1px solid var(--qo-border-color);
}

```


