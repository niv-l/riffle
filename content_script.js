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

    function createOutlineUI(treeData) {
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
        document.body.appendChild(outlineContainer);

        outlineVisible = true;
        selectedOutlineId = null;
        isGloballyCollapsed = false;

        applyCollapseState(false, false);

        const firstVisibleItem = getVisibleItems()[0];
        if (firstVisibleItem) {
            updateSelection(firstVisibleItem.dataset.outlineId, 'instant');
        } else {
            updateSelection(null);
        }

        setTimeout(() => searchInput.focus(), 50);

        document.addEventListener('keydown', handleGlobalKeydown, true);
        document.addEventListener('mousedown', handleOutsideClick, true);
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
        document.removeEventListener('mousedown', handleOutsideClick, true);

        if (outlineContainer) {
            outlineContainer.remove();
        }
        outlineContainer = null;
        searchInput = null;
        listElement = null;
        listItemsMap.clear();
        flatListNodes = [];
        headingTree = []; // Keep resetting headingTree if UI is removed
        outlineVisible = false;
        selectedOutlineId = null;
        isGloballyCollapsed = false;
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
        item.element.style.display = isHiddenByCollapse ? 'none' : '';

        const currentSearchQuery = searchInput ? searchInput.value.toLowerCase().trim() : '';

        if (currentSearchQuery !== '') {
            if (!isHiddenByCollapse) {
                const matchesSearch = item.element.classList.contains('search-match');
                const isRevealedParent = item.element.classList.contains('search-reveal-parent');

                if (!matchesSearch && !isRevealedParent) {
                    item.element.style.display = 'none';
                    item.element.classList.add('search-hidden');
                } else {
                    item.element.style.display = '';
                    item.element.classList.remove('search-hidden');
                }
            } else {
                item.element.classList.add('search-hidden');
            }
        } else {
             item.element.classList.remove('search-hidden', 'search-reveal-parent', 'search-match');
        }
    }

     function handleSearch() {
        const query = searchInput.value.toLowerCase().trim();
        let firstVisibleMatchId = null;

        listItemsMap.forEach(({ element }) => {
            element.classList.remove('search-match', 'search-hidden', 'search-reveal-parent');
            if (element.classList.contains('collapsible')) {
                const nodeData = listItemsMap.get(element.dataset.outlineId)?.nodeData;
                if (nodeData) {
                    element.classList.toggle('collapsed', nodeData.collapsed);
                    element.classList.toggle('expanded', !nodeData.collapsed);
                }
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
         const isOtherInputFocused = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable) && activeEl !== searchInput;

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
         return Array.from(listElement?.children || []).filter(li => {
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
                 queue.push(...currentNodeData.children);
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


    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "toggleOutline") {
            if (outlineVisible) {
                removeOutlineUI();
            } else {
                headingTree = generateOutlineTree();
                if (headingTree.length > 0) {
                    createOutlineUI(headingTree);
                } else {
                  console.warn("Riffle: Could not find any headlines.", e)
                }
            }
            sendResponse({ status: "done", visible: outlineVisible });
        } else if (request.action === "ping") {
            sendResponse({ status: "ready" });
        }
        return true;
    });

    const highlightStyle = document.createElement('style');
    highlightStyle.textContent = `
      @keyframes quickOutlineFadeOut {
          from { background-color: var(--qo-highlight-bg, #cfe2ff); }
          to { background-color: transparent; }
      }
      .quick-outline-highlight {
          background-color: var(--qo-highlight-bg, #cfe2ff) !important;
          transition: background-color 0.5s ease-out 0.7s;
          scroll-margin-top: 80px;
      }
      :root {
         --qo-highlight-bg: #ad97cc;
      }
      @media (prefers-color-scheme: dark) {
         :root {
           --qo-highlight-bg: #8d77bd;
         }
      }
    `;
    try {
        (document.head || document.documentElement).appendChild(highlightStyle);
    } catch (e) {
        console.warn("Riffle: Could not inject heading highlight styles.", e);
    }

    const outlineStyle = document.createElement('style');
    outlineStyle.textContent = `
        :root {
          --qo-bg-color: #ffffff;
          --qo-text-color: #212529;
          --qo-border-color: #dee2e6;
          --qo-input-bg: #ffffff;
          --qo-input-border: #ced4da;
          --qo-item-hover-bg: #f8f9fa;
          --qo-item-selected-bg: #e9ecef;
          --qo-item-selected-text: #000;
          --qo-toggle-color: #6c757d;
          --qo-toggle-hover-color: #343a40;
          --qo-number-color: #adb5bd;
          --qo-scrollbar-thumb: #adb5bd;
          --qo-scrollbar-track: #f1f3f5;
          --qo-shadow-color: rgba(0, 0, 0, 0.1);
          --qo-search-match-bg: #cdd6ff;
          --qo-selection-indicator-color: #964ac2;
        }
        @media (prefers-color-scheme: dark) {
          :root {
            --qo-bg-color: #0a0c12;
            --qo-text-color: #788C9E;
            --qo-border-color: #4a4a4f;
            --qo-input-bg: #0F111A;
            --qo-input-border: #5a5a5f;
            --qo-item-hover-bg: #131721;
            --qo-item-selected-bg: #131721;
            --qo-item-selected-text: #BD5656;
            --qo-toggle-color: #a0a0a5;
            --qo-toggle-hover-color: #e4e6eb;
            --qo-number-color: #8e8e93;
            --qo-scrollbar-thumb: #5a5a5f;
            --qo-scrollbar-track: #3a3a3c;
            --qo-shadow-color: rgba(0, 0, 0, 0.4);
            --qo-search-match-bg: #4a2323;
            --qo-selection-indicator-color: #BD5656;
          }
        }
        #quick-outline-container {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 90%;
          max-width: 550px;
          max-height: 75vh;
          background-color: var(--qo-bg-color);
          color: var(--qo-text-color);
          border: 0px solid var(--qo-border-color);
          border-radius: 8px;
          box-shadow: 0 10px 30px var(--qo-shadow-color);
          z-index: 2147483647;
          display: flex;
          flex-direction: column;
          font-family: "JetBrainsMono NF", "JetBrains Mono", Menlo, Monaco, Consolas, "Courier New", monospace;
          font-size: 15px;
          overflow: hidden;
        }
        #quick-outline-container input[type="search"] {
          padding: 12px 16px;
          border: none;
          font-size: 1em;
          font-family: inherit;
          outline: none;
          width: 100%;
          box-sizing: border-box;
          background-color: var(--qo-input-bg);
          color: var(--qo-text-color);
          flex-shrink: 0;
        }
        #quick-outline-container input[type="search"]::placeholder {
          color: var(--qo-number-color);
          opacity: 0.7;
        }
        #quick-outline-container input[type="search"]::-webkit-search-cancel-button,
        #quick-outline-container input[type="search"]::-webkit-search-decoration {
            -webkit-appearance: none;
            appearance: none;
        }
        #quick-outline-container .outline-list-container {
          overflow-y: auto;
          flex-grow: 1;
          padding: 5px 0;
          scrollbar-width: thin;
          scrollbar-color: var(--qo-scrollbar-thumb) var(--qo-scrollbar-track);
        }
        #quick-outline-container .outline-list-container::-webkit-scrollbar { width: 8px; }
        #quick-outline-container .outline-list-container::-webkit-scrollbar-track { background: var(--qo-scrollbar-track); }
        #quick-outline-container .outline-list-container::-webkit-scrollbar-thumb { background-color: var(--qo-scrollbar-thumb); border-radius: 4px; border: 2px solid var(--qo-scrollbar-track); }
        #quick-outline-container ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        #quick-outline-container li {
          position: relative;
          cursor: pointer;
          margin: 0;
        }
        .outline-item-wrapper {
            display: flex;
            align-items: center;
            padding: 5px 10px 5px 5px;
            border-radius: 4px;
            margin: 1px 5px 1px 0;
            transition: background-color 0.15s ease;
            min-height: 24px;
        }
        #quick-outline-container li:hover > .outline-item-wrapper {
          background-color: var(--qo-item-hover-bg);
        }
        #quick-outline-container li.selected > .outline-item-wrapper {
          background-color: var(--qo-item-selected-bg);
        }
        #quick-outline-container li.selected > .outline-item-wrapper .outline-item-content,
        #quick-outline-container li.selected > .outline-item-wrapper .outline-item-content .outline-item-number,
        #quick-outline-container li.selected > .outline-item-wrapper .toggle::before
         {
          color: var(--qo-item-selected-text);
          border-color: transparent transparent transparent var(--qo-item-selected-text);
        }
        #quick-outline-container li.selected::before {
            content: '';
            position: absolute;
            left: 2px;
            top: 4px;
            bottom: 4px;
            width: 3px;
            background-color: var(--qo-selection-indicator-color);
            border-radius: 1.5px;
        }
        .outline-item-content {
          display: flex;
          align-items: baseline;
          flex-grow: 1;
          overflow: hidden;
          margin-left: 4px;
        }
        .outline-item-number {
          color: var(--qo-number-color);
          font-size: 0.85em;
          margin-right: 8px;
          text-align: right;
          flex-shrink: 0;
          opacity: 0.8;
          user-select: none;
        }
        .outline-item-text {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex-grow: 1;
        }
        #quick-outline-container li.search-match > .outline-item-wrapper {
             background-color: var(--qo-search-match-bg);
        }
        #quick-outline-container li.selected.search-match > .outline-item-wrapper {
             background-color: var(--qo-item-selected-bg);
        }
        .toggle, .toggle-placeholder {
          width: 18px;
          height: 18px;
          flex-shrink: 0;
          margin-right: 0px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--qo-toggle-color);
          transition: transform 0.2s ease-in-out, color 0.15s ease;
          position: relative;
          user-select: none;
        }
        .toggle {
          cursor: pointer;
        }
        .toggle:hover {
          color: var(--qo-toggle-hover-color);
        }
        .toggle:hover::before {
           border-color: transparent transparent transparent var(--qo-toggle-hover-color);
        }
        .toggle::before {
            content: '';
            display: block;
            width: 0;
            height: 0;
            transition: transform 0.2s ease-in-out, border-color 0.15s ease;
            border-style: solid;
            border-width: 5px 0 5px 6px;
            border-color: transparent transparent transparent var(--qo-toggle-color);
            transform-origin: 3px 5px;
        }
        li.expanded > .outline-item-wrapper > .toggle::before {
          transform: rotate(90deg);
        }
        li.collapsed > .outline-item-wrapper > .toggle::before {
          transform: rotate(0deg);
        }
    `;
     try {
        (document.head || document.documentElement).appendChild(outlineStyle);
    } catch (e) {
        console.warn("Riffle: Could not inject UI styles.", e);
    }

})();
