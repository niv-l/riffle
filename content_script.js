(() => {
    let outlineVisible = false;
    let outlineContainer = null;
    let searchInput = null;
    let listElement = null;
    let headingTree = [];
    let flatListNodes = [];
    let listItemsMap = new Map();
    let selectedOutlineId = null;
    let tempIdCounter = 0;
    let isGloballyCollapsed = false;

    // --- Settings Variables ---
    let currentTheme = 'system';
    let currentFontSize = 15; // Default
    let currentFocusSearchPref = true; // Default
    let customStyleElement = null;
    const CUSTOM_STYLE_ID = 'quick-outline-custom-styles';

    // --- Constants ---
    const OUTLINE_ID_PREFIX = 'quick-outline-item-';
    const HEADING_ID_PREFIX = 'quick-outline-heading-';
    const CONTAINER_ID = 'quick-outline-container';

    function generateOutlineTree() {
        const headingNodes = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        const root = { children: [], level: 0, id: 'root' };
        const stack = [root];
        tempIdCounter = 0;
        let outlineNodeCounter = 0;

        headingNodes.forEach((node) => {
            const style = window.getComputedStyle(node);
            if (node.offsetParent === null || node.offsetHeight <= 0 || node.offsetWidth <= 0 || style.visibility === 'hidden' || style.display === 'none') {
                return;
            }
            if (node.closest(`#${CONTAINER_ID}`)) {
                return;
            }

            const level = parseInt(node.tagName.substring(1));
            const text = node.innerText.trim();
            if (text === '') {
                return;
            }

            let targetId = node.id;
            if (!targetId) {
                targetId = HEADING_ID_PREFIX + tempIdCounter++;
                node.id = targetId;
            }

            const outlineNode = {
                id: OUTLINE_ID_PREFIX + outlineNodeCounter++,
                text: text,
                level: level,
                targetId: targetId,
                element: node,
                children: [],
                parent: null,
                numbering: '',
                collapsed: false
            };

            while (stack.length > 1 && stack[stack.length - 1].level >= level) {
                stack.pop();
            }

            const parent = stack[stack.length - 1];
            outlineNode.parent = (parent === root) ? null : parent;
            parent.children.push(outlineNode);
            stack.push(outlineNode);
        });

        calculateNumbering(root.children);
        return root.children;
    }

    function calculateNumbering(nodes, prefix = '') {
        nodes.forEach((node, index) => {
            node.numbering = prefix ? `${prefix}.${index + 1}` : `${index + 1}`;
            if (node.children.length > 0) {
                calculateNumbering(node.children, node.numbering);
            }
        });
    }

    async function createOutlineUI(treeData) {
        removeOutlineUI();

        outlineContainer = document.createElement('div');
        outlineContainer.id = CONTAINER_ID;
        outlineContainer.addEventListener('mousedown', (e) => e.stopPropagation());
        outlineContainer.addEventListener('click', (e) => e.stopPropagation());

        searchInput = document.createElement('input');
        searchInput.type = 'search';
        searchInput.placeholder = 'Search (Esc: close, /: focus, Tab: collapse/expand)';
        searchInput.addEventListener('input', handleSearch);
        searchInput.addEventListener('keydown', handleSearchKeydown);

        const listContainer = document.createElement('div');
        listContainer.className = 'outline-list-container';

        listElement = document.createElement('ul');
        listElement.addEventListener('click', handleListClick);

        listItemsMap.clear();
        flatListNodes = [];

        renderFlatList(treeData, listElement);

        listContainer.appendChild(listElement);
        outlineContainer.appendChild(searchInput);
        outlineContainer.appendChild(listContainer);

        outlineVisible = true;
        selectedOutlineId = null;
        isGloballyCollapsed = false;

        try {
            await loadAndApplySettings(); // Load theme, font size, custom css etc.
            document.body.appendChild(outlineContainer);
            applyInitialUIState(); // Apply collapse, selection, and focus
        } catch (error) {
            console.error("Riffle: Error applying settings:", error);
             // Fallback: Append and apply defaults if settings load fails
             if (!outlineContainer.parentNode) {
                 document.body.appendChild(outlineContainer);
             }
            applyInitialUIState();
        }

        // Add global listeners
        document.addEventListener('keydown', handleGlobalKeydown, true);
        document.addEventListener('mousedown', handleOutsideClick, true);
        chrome.storage.onChanged.addListener(handleStorageChange);
    }

    async function loadAndApplySettings() {
        const settingsToLoad = ['theme', 'fontSize', 'focusSearch', 'customCSS'];
        const result = await chrome.storage.sync.get(settingsToLoad);

        // Theme
        currentTheme = result.theme || 'system';
        applyThemeClass(currentTheme);

        // Font Size
        currentFontSize = result.fontSize || 15;
        applyFontSize(currentFontSize);

        // Focus Preference (used later in applyInitialUIState)
        currentFocusSearchPref = result.focusSearch === undefined ? true : result.focusSearch;

        // Custom CSS
        applyCustomCSS(result.customCSS || '');
    }

    function applyInitialUIState() {
         // Apply initial collapse state (expand all by default)
        applyCollapseState(false, false); // Don't refocus search here

        // Select the first visible item
        const firstVisibleItem = getVisibleItems()[0];
        if (firstVisibleItem) {
            updateSelection(firstVisibleItem.dataset.outlineId, 'instant');
        } else {
            updateSelection(null); // No items visible
        }

        // Focus search input based on preference, after a short delay
        if (currentFocusSearchPref && searchInput) {
            setTimeout(() => searchInput.focus(), 50);
        }
    }

    function applyThemeClass(theme) {
        if (!outlineContainer) return;
        outlineContainer.classList.remove('force-light', 'force-dark');
        if (theme === 'light') {
            outlineContainer.classList.add('force-light');
        } else if (theme === 'dark') {
            outlineContainer.classList.add('force-dark');
        }
    }

    function applyFontSize(size) {
        if (!outlineContainer) return;
        outlineContainer.style.fontSize = `${size}px`;
    }

    function applyCustomCSS(css) {
        // Remove existing style element if it exists
        if (customStyleElement && customStyleElement.parentNode) {
            customStyleElement.remove();
        }
        customStyleElement = null; // Reset reference

        if (css && typeof css === 'string' && css.trim() !== '') {
            customStyleElement = document.createElement('style');
            customStyleElement.id = CUSTOM_STYLE_ID;
            customStyleElement.textContent = css;
            document.head.appendChild(customStyleElement);
        }
    }

     function handleOutsideClick(event) {
        if (outlineVisible && outlineContainer && !outlineContainer.contains(event.target)) {
            removeOutlineUI();
        }
    }

    function renderFlatList(nodes, targetUl) {
        nodes.forEach(nodeData => {
            const li = createListItemElement(nodeData);
            targetUl.appendChild(li);
            listItemsMap.set(nodeData.id, { element: li, nodeData: nodeData });
            flatListNodes.push(nodeData.id);

            if (nodeData.children.length > 0) {
                renderFlatList(nodeData.children, targetUl);
            }
        });
    }

    function createListItemElement(nodeData) {
        const li = document.createElement('li');
        li.dataset.outlineId = nodeData.id;
        li.dataset.targetId = nodeData.targetId;
        li.dataset.level = nodeData.level;
        li.dataset.hasChildren = nodeData.children.length > 0;
        li.style.paddingLeft = `${(nodeData.level - 1) * 18 + 15}px`;

        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'outline-item-wrapper';

        if (nodeData.children.length > 0) {
            li.classList.add('collapsible');
            const toggle = document.createElement('span');
            toggle.className = 'toggle';
            contentWrapper.appendChild(toggle);
        } else {
            const placeholder = document.createElement('span');
            placeholder.className = 'toggle-placeholder';
            contentWrapper.appendChild(placeholder);
        }

        const content = document.createElement('span');
        content.className = 'outline-item-content';

        const numberSpan = document.createElement('span');
        numberSpan.className = 'outline-item-number';
        numberSpan.textContent = nodeData.numbering + '.';

        const textSpan = document.createElement('span');
        textSpan.className = 'outline-item-text';
        textSpan.textContent = nodeData.text;

        content.appendChild(numberSpan);
        content.appendChild(textSpan);
        contentWrapper.appendChild(content);
        li.appendChild(contentWrapper);

        if (li.classList.contains('collapsible')) {
             li.classList.toggle('collapsed', nodeData.collapsed);
             li.classList.toggle('expanded', !nodeData.collapsed);
        }
        return li;
    }

    function removeOutlineUI() {
        document.removeEventListener('keydown', handleGlobalKeydown, true);
        chrome.storage.onChanged.removeListener(handleStorageChange);
        document.removeEventListener('mousedown', handleOutsideClick, true);

        if (outlineContainer) {
            outlineContainer.remove();
        }
        if (customStyleElement && customStyleElement.parentNode) {
             customStyleElement.remove(); // Remove custom CSS tag
        }

        outlineContainer = null;
        searchInput = null;
        listElement = null;
        customStyleElement = null;
        listItemsMap.clear();
        flatListNodes = [];
        headingTree = [];
        outlineVisible = false;
        selectedOutlineId = null;
        isGloballyCollapsed = false;
        // Reset settings variables to defaults
        currentTheme = 'system';
        currentFontSize = 15;
        currentFocusSearchPref = true;
    }

    function scrollToHeading(targetId) {
        if (searchInput) searchInput.blur();

        const targetElement = document.getElementById(targetId);
        if (targetElement) {
            targetElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
            targetElement.classList.add('quick-outline-highlight');
            setTimeout(() => {
                 if (targetElement) {
                     targetElement.classList.remove('quick-outline-highlight');
                 }
            }, 1200);
        }
    }

    function isElementHiddenByAncestorCollapse(elementLi) {
        if (!elementLi) return true;

        let currentId = elementLi.dataset.outlineId;
        let nodeInfo = listItemsMap.get(currentId);
        if (!nodeInfo || !nodeInfo.nodeData) return true;

        let parentNode = nodeInfo.nodeData.parent;

        while (parentNode && parentNode.id !== 'root') {
            const parentItem = listItemsMap.get(parentNode.id);
            if (!parentItem || !parentItem.nodeData || parentItem.nodeData.collapsed) {
                return true;
            }
            parentNode = parentItem.nodeData.parent;
        }
        return false;
    }

     function updateItemVisibility(outlineId) {
        const item = listItemsMap.get(outlineId);
        if (!item || !item.element || !item.nodeData) return;

        const isHiddenByCollapse = isElementHiddenByAncestorCollapse(item.element);
        let shouldBeVisible = !isHiddenByCollapse;

        const currentSearchQuery = searchInput ? searchInput.value.toLowerCase().trim() : '';

        if (shouldBeVisible && currentSearchQuery !== '') {
            const isDirectMatch = item.element.classList.contains('search-match');
            const isRevealedParent = item.element.classList.contains('search-reveal-parent');
            if (!isDirectMatch && !isRevealedParent) {
                shouldBeVisible = false;
                item.element.classList.add('search-hidden');
            } else {
                item.element.classList.remove('search-hidden');
            }
        } else {
            item.element.classList.remove('search-hidden');
        }

        item.element.style.display = shouldBeVisible ? '' : 'none';

        if (currentSearchQuery === '') {
            item.element.classList.remove('search-reveal-parent', 'search-match');
        }
    }

     function handleSearch() {
        const query = searchInput.value.toLowerCase().trim();
        let firstVisibleMatchId = null;

        listItemsMap.forEach(({ element, nodeData }) => {
            element.classList.remove('search-match', 'search-hidden', 'search-reveal-parent');
            if (element.classList.contains('collapsible')) {
                 element.classList.toggle('collapsed', nodeData.collapsed);
                 element.classList.toggle('expanded', !nodeData.collapsed);
            }
        });

        if (query === '') {
            flatListNodes.forEach(nodeId => updateItemVisibility(nodeId));
            const currentItem = selectedOutlineId ? listItemsMap.get(selectedOutlineId)?.element : null;
            if (!currentItem || currentItem.style.display === 'none') {
                 const firstVisible = getVisibleItems()[0];
                 updateSelection(firstVisible ? firstVisible.dataset.outlineId : null, 'instant');
            } else {
                 currentItem.scrollIntoView({ behavior: 'instant', block: 'nearest'});
            }
            return;
        }

        const matches = [];
        listItemsMap.forEach(({ element, nodeData }) => {
            const nodeText = nodeData.text.toLowerCase();
            const isMatch = nodeText.includes(query);
            if (isMatch) {
                element.classList.add('search-match');
                matches.push(nodeData.id);
            }
        });

        matches.forEach(matchId => {
            let currentId = matchId;
            while (currentId) {
                const item = listItemsMap.get(currentId);
                if (!item) break;
                const parentNode = item.nodeData.parent;
                const parentId = parentNode ? parentNode.id : null;

                if (parentId && parentId !== 'root') {
                    const parentItem = listItemsMap.get(parentId);
                    if (parentItem) {
                         parentItem.element.classList.add('search-reveal-parent');
                         if (parentItem.element.classList.contains('collapsible')) {
                            parentItem.element.classList.remove('collapsed');
                            parentItem.element.classList.add('expanded');
                         }
                    }
                    currentId = parentId;
                } else {
                    currentId = null;
                }
            }
        });

        flatListNodes.forEach(nodeId => updateItemVisibility(nodeId));

        const visibleItemsNow = getVisibleItems();
        firstVisibleMatchId = visibleItemsNow.find(li => li.classList.contains('search-match'))?.dataset?.outlineId || null;

        const currentSelectionData = selectedOutlineId ? listItemsMap.get(selectedOutlineId) : null;
        const isCurrentSelectionVisible = currentSelectionData && currentSelectionData.element.style.display !== 'none';

        if (firstVisibleMatchId && (!isCurrentSelectionVisible || !currentSelectionData?.element.classList.contains('search-match'))) {
            updateSelection(firstVisibleMatchId, 'instant');
        } else if (!visibleItemsNow.length) {
            updateSelection(null);
        } else if (isCurrentSelectionVisible) {
             currentSelectionData.element.scrollIntoView({ behavior: 'instant', block: 'nearest' });
        } else if (visibleItemsNow.length > 0 && !selectedOutlineId) {
            updateSelection(visibleItemsNow[0].dataset.outlineId, 'instant');
        }
    }


    function handleSearchKeydown(event) {
        if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape', 'Tab'].includes(event.key)) {
            return;
        }
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
             event.stopPropagation();
        }
        if (event.key === '/') {
             event.stopPropagation();
        }
    }


    function handleListClick(event) {
        const targetLi = event.target.closest('li');
        if (!targetLi) return;

        const outlineId = targetLi.dataset.outlineId;
        if (!outlineId) return;
        const item = listItemsMap.get(outlineId);
        if (!item) return;

        if (event.target.classList.contains('toggle')) {
            toggleCollapse(outlineId);
             item.element.scrollIntoView({ behavior: 'instant', block: 'nearest' });
        } else {
            updateSelection(outlineId, 'instant');
            selectItem();
        }
    }

    function handleGlobalKeydown(event) {
        if (!outlineVisible) return;

         const activeEl = document.activeElement;
         const isOtherInputFocused = activeEl &&
                                   (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable) &&
                                   activeEl !== searchInput;

         if (event.key === '/' && !isOtherInputFocused) {
            event.preventDefault();
            event.stopPropagation();
            searchInput.select();
            searchInput.focus();
            return;
         }

         if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            removeOutlineUI();
            return;
         }

         if (isOtherInputFocused) {
             return;
         }

        if (event.key === 'Tab') {
            event.preventDefault();
            event.stopPropagation();

            const hadFocus = (document.activeElement === searchInput);

             if (searchInput && searchInput.value !== '') {
                 searchInput.value = '';
                 handleSearch();
             }

            isGloballyCollapsed = !isGloballyCollapsed;
            applyCollapseState(isGloballyCollapsed, hadFocus);
            return;
        }

        if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(event.key)) {
            event.preventDefault();
            event.stopPropagation();

            if (event.key === 'ArrowDown') {
                navigateToNextItem();
            } else if (event.key === 'ArrowUp') {
                navigateToPreviousItem();
            } else if (event.key === 'Enter') {
                selectItem();
            } else if (selectedOutlineId) {
                const currentItem = listItemsMap.get(selectedOutlineId);
                if (!currentItem || !currentItem.element.classList.contains('collapsible')) {
                     if (event.key === 'ArrowLeft') {
                         const parentLi = findParentElementLi(selectedOutlineId);
                         if (parentLi && parentLi.style.display !== 'none') {
                             updateSelection(parentLi.dataset.outlineId, 'instant');
                         }
                     }
                    return;
                }

                if (event.key === 'ArrowLeft') {
                    if (currentItem.element.classList.contains('expanded')) {
                        collapseNode(selectedOutlineId);
                        currentItem.element.scrollIntoView({ behavior: 'instant', block: 'nearest' });
                    } else {
                        const parentLi = findParentElementLi(selectedOutlineId);
                        if (parentLi && parentLi.style.display !== 'none') {
                            updateSelection(parentLi.dataset.outlineId, 'instant');
                        }
                    }
                } else if (event.key === 'ArrowRight') {
                    if (currentItem.element.classList.contains('collapsed')) {
                        expandNode(selectedOutlineId);
                        currentItem.element.scrollIntoView({ behavior: 'instant', block: 'nearest' });
                    } else if (currentItem.element.classList.contains('expanded')) {
                        const firstVisibleChildLi = findFirstVisibleChildLi(selectedOutlineId);
                         if (firstVisibleChildLi) {
                             updateSelection(firstVisibleChildLi.dataset.outlineId, 'instant');
                         }
                    }
                }
            }
        }
    }

    function getVisibleItems() {
         if (!listElement) {
             return [];
         }
         return Array.from(listElement.children).filter(li => {
             if (li.style.display === 'none') {
                 return false;
             }
             return true;
         });
     }

    function findParentElementLi(outlineId) {
        const nodeInfo = listItemsMap.get(outlineId);
        const parentNode = nodeInfo?.nodeData?.parent;
        if (parentNode && parentNode.id !== 'root') {
            return listItemsMap.get(parentNode.id)?.element || null;
        }
        return null;
    }

     function findFirstVisibleChildLi(parentId) {
         const parentData = listItemsMap.get(parentId)?.nodeData;
         if (!parentData || parentData.children.length === 0) return null;

         for (const childNode of parentData.children) {
              const childLi = listItemsMap.get(childNode.id)?.element;
              if (childLi && childLi.style.display !== 'none') {
                  return childLi;
              }
         }
         return null;
     }

    function navigateToNextItem() {
        const visibleItems = getVisibleItems();
        if (visibleItems.length === 0) return;

        let currentIndex = -1;
        if (selectedOutlineId) {
            currentIndex = visibleItems.findIndex(li => li.dataset.outlineId === selectedOutlineId);
        }

        const nextIndex = (currentIndex + 1) % visibleItems.length;
        const nextItem = visibleItems[nextIndex];

        if (nextItem) {
            updateSelection(nextItem.dataset.outlineId, 'instant');
        }
    }

    function navigateToPreviousItem() {
        const visibleItems = getVisibleItems();
        if (visibleItems.length === 0) return;

        let currentIndex = 0;
        if (selectedOutlineId) {
            const foundIndex = visibleItems.findIndex(li => li.dataset.outlineId === selectedOutlineId);
            if (foundIndex !== -1) {
                currentIndex = foundIndex;
            }
        }

        const prevIndex = (currentIndex - 1 + visibleItems.length) % visibleItems.length;
        const prevItem = visibleItems[prevIndex];

        if (prevItem) {
            updateSelection(prevItem.dataset.outlineId, 'instant');
        }
    }

    function updateSelection(newOutlineId, scrollBehavior = 'smooth') {
        if (selectedOutlineId && listItemsMap.has(selectedOutlineId)) {
            listItemsMap.get(selectedOutlineId)?.element?.classList.remove('selected');
        }

        selectedOutlineId = newOutlineId;

        if (selectedOutlineId && listItemsMap.has(selectedOutlineId)) {
            const selectedItem = listItemsMap.get(selectedOutlineId);
            if(selectedItem?.element){
                 selectedItem.element.classList.add('selected');
                 if (selectedItem.element.style.display !== 'none') {
                     selectedItem.element.scrollIntoView({
                         behavior: scrollBehavior,
                         block: 'nearest'
                     });
                 }
            } else {
                 selectedOutlineId = null;
            }
        }
    }


    function selectItem() {
        if (selectedOutlineId && listItemsMap.has(selectedOutlineId)) {
            const { nodeData } = listItemsMap.get(selectedOutlineId);
            if (nodeData?.targetId) {
                scrollToHeading(nodeData.targetId);
                removeOutlineUI();
            }
        }
    }


    function toggleCollapse(outlineId) {
        const item = listItemsMap.get(outlineId);
        if (!item || !item.element.classList.contains('collapsible')) return;

        if (item.nodeData.collapsed) {
            expandNode(outlineId);
        } else {
            collapseNode(outlineId);
        }
         if (document.activeElement === searchInput) {
             searchInput.focus();
         }
    }

    function setDescendantsVisibility(startNodeId, makeVisible, updateSelfData = true) {
        const startItem = listItemsMap.get(startNodeId);
        if (!startItem || !startItem.nodeData || !startItem.element.classList.contains('collapsible')) {
             return;
        }

        const startNodeData = startItem.nodeData;
        const startElement = startItem.element;
        const isCollapsing = !makeVisible;

        if (updateSelfData) {
             startNodeData.collapsed = isCollapsing;
             startElement.classList.toggle('collapsed', isCollapsing);
             startElement.classList.toggle('expanded', !isCollapsing);
        }

        const queue = [...startNodeData.children];
        while (queue.length > 0) {
             const currentNodeData = queue.shift();
             updateItemVisibility(currentNodeData.id);

             if (currentNodeData.children.length > 0) {
                 if (!isCollapsing && !currentNodeData.collapsed || isCollapsing) {
                     queue.push(...currentNodeData.children);
                 }
             }
        }
    }


    function collapseNode(outlineId) {
        setDescendantsVisibility(outlineId, false, true);
    }

    function expandNode(outlineId) {
        setDescendantsVisibility(outlineId, true, true);
    }


     function applyCollapseState(collapseToH1, focusSearchAfter = false) {
        isGloballyCollapsed = collapseToH1;

        listItemsMap.forEach(({ element, nodeData }) => {
            let shouldBeCollapsed;

            if (collapseToH1) {
                shouldBeCollapsed = nodeData.level > 1;
            } else {
                shouldBeCollapsed = false;
            }

            nodeData.collapsed = shouldBeCollapsed;

            if (element.classList.contains('collapsible')) {
                 element.classList.toggle('collapsed', nodeData.collapsed);
                 element.classList.toggle('expanded', !nodeData.collapsed);
            }
        });

        flatListNodes.forEach(nodeId => {
            updateItemVisibility(nodeId);
        });

        const firstVisible = getVisibleItems()[0];
        if (firstVisible) {
             updateSelection(firstVisible.dataset.outlineId, 'instant');
        } else {
             updateSelection(null);
        }

         if (focusSearchAfter && searchInput) {
              setTimeout(() => searchInput.focus(), 0);
         }
    }

    function handleStorageChange(changes, areaName) {
        if (areaName !== 'sync' || !outlineVisible) {
            return; // Ignore if not sync storage or outline isn't open
        }

        if (changes.theme) {
            const newTheme = changes.theme.newValue || 'system';
            if (newTheme !== currentTheme) {
                currentTheme = newTheme;
                applyThemeClass(currentTheme);
                console.log("Riffle: Theme updated to", currentTheme);
            }
        }

        if (changes.fontSize) {
            const newSize = changes.fontSize.newValue || 15;
            if (newSize !== currentFontSize) {
                currentFontSize = newSize;
                applyFontSize(currentFontSize);
                console.log("Riffle: Font size updated to", currentFontSize);
            }
        }

         if (changes.customCSS) {
            const newCSS = changes.customCSS.newValue || '';
            // Check if CSS actually changed before reapplying
            if (!customStyleElement || newCSS !== customStyleElement.textContent) {
                 applyCustomCSS(newCSS);
                 console.log("Riffle: Custom CSS updated.");
            }
        }

        if (changes.focusSearch) {
            // Update preference, but doesn't change focus state dynamically
            currentFocusSearchPref = changes.focusSearch.newValue === undefined ? true : changes.focusSearch.newValue;
            console.log("Riffle: Focus search preference updated to", currentFocusSearchPref);
        }
    }

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "toggleOutline") {
            if (outlineVisible) {
                removeOutlineUI();
                sendResponse({ status: "closed", visible: false });
            } else {
                headingTree = generateOutlineTree();
                if (headingTree.length > 0) {
                    // createOutlineUI is now async
                    createOutlineUI(headingTree)
                        .then(() => {
                            sendResponse({ status: "opened", visible: true });
                        })
                        .catch(error => {
                            console.error("Riffle: Failed to create outline UI", error);
                            sendResponse({ status: "error", visible: false, message: error.message });
                        });
                    return true; // Indicate async response for createOutlineUI
                } else {
                  console.warn("Riffle: No heading elements (H1-H6) found on this page.");
                  sendResponse({ status: "no_headings", visible: false });
                }
            }
        } else if (request.action === "ping") {
            sendResponse({ status: "ready" });
        } else {
            // Handle unknown messages potentially?
             sendResponse({ status: "unknown_message" });
        }
        // Return true ONLY if sendResponse might be called asynchronously (like in the createOutlineUI promise chain)
        // If sendResponse is called synchronously in all branches, return false or omit the return.
        // In this updated logic, we need 'true' because of the async createOutlineUI call.
        return true;
    });

})();
