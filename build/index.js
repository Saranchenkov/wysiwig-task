const NODE_NAMES = {
    H1: 'H1',
    H2: 'H2',
    PARAGRAPH: 'P',
    BOLD: 'STRONG',
    ITALIC: 'I',
};
const BLOCK_NODES = [NODE_NAMES.H1, NODE_NAMES.H2, NODE_NAMES.PARAGRAPH];
const INLINE_NODES = [NODE_NAMES.BOLD, NODE_NAMES.ITALIC];
const CLASS_MAP = {
    [NODE_NAMES.H1]: 'header1-text',
    [NODE_NAMES.H2]: 'header2-text',
    [NODE_NAMES.PARAGRAPH]: '',
    [NODE_NAMES.BOLD]: 'bold-text',
    [NODE_NAMES.ITALIC]: 'italic-text',
};

function isElementNode(node) {
    return node.nodeType === Node.ELEMENT_NODE;
}
function setStyleToElement(node) {
    if (!isElementNode(node))
        return;
    const element = node;
    const className = CLASS_MAP[element.nodeName];
    element.removeAttribute('style');
    if (className) {
        element.setAttribute('class', className);
    }
    else {
        element.removeAttribute('class');
    }
}
function getCurrentSelection() {
    return document.getSelection();
}
function isBlockNodeName(nodeName) {
    return BLOCK_NODES.includes(nodeName.toUpperCase());
}
function isBlockNode(node) {
    return isBlockNodeName(node.nodeName);
}
function isInlineNodeName(nodeName) {
    return INLINE_NODES.includes(nodeName.toUpperCase());
}
function isTextNode(node) {
    return node.nodeType === Node.TEXT_NODE;
}
function iterateChildNodes(node, callback) {
    let currentChildNode = node.firstChild;
    while (currentChildNode) {
        const nextSibling = callback(currentChildNode);
        if (nextSibling === currentChildNode) {
            console.warn('iterateChildNodes infinite loop possible');
        }
        currentChildNode = nextSibling ?? currentChildNode.nextSibling;
    }
}
function replaceNode(oldNode, newNode, parentNode) {
    iterateChildNodes(oldNode, (childNode) => {
        const nextNode = childNode.nextSibling;
        newNode.appendChild(childNode);
        return nextNode;
    });
    parentNode.replaceChild(newNode, oldNode);
}
function replaceNodeName(oldNode, newNodeName, parentNode) {
    if (oldNode.nodeName === newNodeName)
        return oldNode;
    const newNode = document.createElement(newNodeName);
    replaceNode(oldNode, newNode, parentNode);
    return newNode;
}
function replaceNameOfStaticNode(staticNode, newNodeName) {
    const newNode = document.createElement(newNodeName);
    iterateChildNodes(staticNode, (childNode) => {
        const nextNode = childNode.nextSibling;
        newNode.appendChild(childNode);
        return nextNode;
    });
    return newNode;
}
function getEditableAreaElement() {
    const element = document.getElementById('edit-area');
    if (!element) {
        throw new Error('Editor element is not found');
    }
    return element;
}
function hasParentWithNodeName(currentNode, parentNodeName) {
    const rootNode = getEditableAreaElement();
    if (!rootNode.contains(currentNode))
        return false;
    let parent = currentNode.parentNode;
    while (parent && parent !== rootNode) {
        if (parent.nodeName.toUpperCase() === parentNodeName.toUpperCase()) {
            return true;
        }
        parent = parent.parentNode;
    }
    return false;
}
function convertToNode(nodeOrText) {
    return typeof nodeOrText === 'string'
        ? document.createTextNode(nodeOrText)
        : nodeOrText;
}
function wrapTextNodeIntoSpecificNode(params) {
    const { textNode, wrapperNode, range } = params;
    const text = textNode.textContent ?? '';
    wrapperNode.textContent = text.slice(range.start, range.end);
    const newChildren = [
        text.slice(0, range.start),
        wrapperNode,
        text.slice(range.end),
    ];
    const parent = textNode.parentNode;
    if (parent) {
        newChildren.forEach((child) => {
            const newChild = convertToNode(child);
            if (newChild.textContent) {
                parent.insertBefore(convertToNode(child), textNode);
            }
        });
        parent.removeChild(textNode);
    }
}
function insertEmptyParagraphAndFocus(parentElement) {
    const paragraph = document.createElement('p');
    setStyleToElement(paragraph);
    paragraph.appendChild(document.createElement('br'));
    parentElement.appendChild(paragraph);
    const range = document.createRange();
    range.setStart(paragraph, 0);
    range.setEnd(paragraph, 0);
    const selection = getCurrentSelection();
    if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
    }
}
function updateButtonActiveStatus(range) {
    if (!range.collapsed)
        return;
    const elementWithCursor = range.startContainer;
    const rootNode = getEditableAreaElement();
    if (!rootNode.contains(elementWithCursor))
        return;
    const buttonElementList = document.querySelectorAll('button[data-command]');
    buttonElementList.forEach((buttonElement) => {
        const nodeName = buttonElement.getAttribute('data-command') ?? '';
        const isActive = hasParentWithNodeName(elementWithCursor, nodeName.toUpperCase());
        buttonElement.setAttribute('data-active', String(isActive));
    });
}
function iterateSelectedNodes(callback) {
    const selection = getCurrentSelection();
    if (!selection)
        return;
    const range = selection.getRangeAt(0);
    const ancestorNode = range.commonAncestorContainer;
    const rootNode = isTextNode(ancestorNode)
        ? ancestorNode.parentNode
        : ancestorNode;
    function handleChild(childNode) {
        if (!selection || !selection.containsNode(childNode, true))
            return null;
        callback(childNode);
        iterateChildNodes(childNode, handleChild);
        return null;
    }
    if (rootNode) {
        iterateChildNodes(rootNode, handleChild);
    }
}
function cloneOneSideOfNodeTree(params) {
    const { ancestorNode, dividerTextNode, dividerTextOffset, cloneDirection, } = params;
    if (!dividerTextNode ||
        dividerTextNode === ancestorNode ||
        !ancestorNode.contains(dividerTextNode))
        return ancestorNode;
    function getNextSiblingToClone(node) {
        if (!node)
            return null;
        return cloneDirection === 'left' ? node.previousSibling : node.nextSibling;
    }
    function addChild(options) {
        const { parentNode, currentNode, newChildNode } = options;
        if (cloneDirection === 'left') {
            parentNode.insertBefore(newChildNode, currentNode);
        }
        else {
            parentNode.appendChild(newChildNode);
        }
    }
    const fullText = dividerTextNode.textContent ?? '';
    const newTextContent = cloneDirection === 'left'
        ? fullText.slice(0, dividerTextOffset)
        : fullText.slice(dividerTextOffset);
    let currentNode = dividerTextNode;
    let currentParentNode = dividerTextNode.parentNode;
    let currentCloneNode = document.createTextNode(newTextContent);
    let currentParentCloneNode = currentParentNode
        ? currentParentNode.cloneNode(false)
        : null;
    if (currentParentCloneNode) {
        currentParentCloneNode.appendChild(currentCloneNode);
    }
    /** until we achieve the top of tree */
    while (currentParentNode &&
        currentParentCloneNode &&
        currentNode !== ancestorNode) {
        let currentSiblingNode = getNextSiblingToClone(currentNode);
        while (currentSiblingNode) {
            const siblingClone = currentSiblingNode.cloneNode(true);
            if (currentParentCloneNode && currentCloneNode) {
                addChild({
                    parentNode: currentParentCloneNode,
                    currentNode: currentCloneNode,
                    newChildNode: siblingClone,
                });
            }
            currentNode = currentSiblingNode;
            currentCloneNode = siblingClone;
            currentSiblingNode = getNextSiblingToClone(currentNode);
        }
        currentNode = currentParentNode;
        currentCloneNode = currentParentCloneNode;
        currentParentNode = currentNode.parentNode;
        currentParentCloneNode = currentParentNode
            ? currentParentNode.cloneNode(false)
            : null;
        if (currentParentCloneNode) {
            currentParentCloneNode.appendChild(currentCloneNode);
        }
    }
    return currentCloneNode ?? ancestorNode;
}
function removeOneSideOfTree(params) {
    const { ancestorNode, dividerTextNode, dividerTextOffset, removeDirection, } = params;
    if (!dividerTextNode ||
        dividerTextNode === ancestorNode ||
        !ancestorNode.contains(dividerTextNode))
        return ancestorNode;
    function getNextSiblingToRemove(node) {
        return removeDirection === 'right'
            ? node.nextSibling
            : node.previousSibling;
    }
    const fullText = dividerTextNode.textContent ?? '';
    dividerTextNode.textContent =
        removeDirection === 'left'
            ? fullText.slice(dividerTextOffset)
            : fullText.slice(0, dividerTextOffset);
    let currentNode = dividerTextNode;
    let currentParentNode = currentNode.parentNode;
    while (currentParentNode && currentNode !== ancestorNode) {
        let siblingToRemove = getNextSiblingToRemove(currentNode);
        while (siblingToRemove) {
            currentParentNode.removeChild(siblingToRemove);
            siblingToRemove = getNextSiblingToRemove(currentNode);
        }
        currentNode = currentParentNode;
        currentParentNode = currentNode.parentNode;
    }
    return currentNode;
}
function splitNodeByTextNode(params) {
    const { ancestorNode, dividerTextNode, dividerTextOffset } = params;
    const leftSideClone = cloneOneSideOfNodeTree({
        ancestorNode: ancestorNode,
        dividerTextNode,
        dividerTextOffset,
        cloneDirection: 'left',
    });
    const rightSideClone = cloneOneSideOfNodeTree({
        ancestorNode: ancestorNode,
        dividerTextNode,
        dividerTextOffset,
        cloneDirection: 'right',
    });
    return [leftSideClone, rightSideClone];
}
function applyComputedStyle(currentNode, cloneNode) {
    if (!isElementNode(currentNode) || !isElementNode(cloneNode))
        return cloneNode;
    /** some properties can be added in future */
    const STYLE_FIELDS = [
        'font-style',
        'font-variant',
        'font-weight',
        'font-stretch',
        'font-size',
        'line-height',
        'font-family',
        'color',
        'background-color',
        'text-decoration',
        'text-transform',
        'text-align',
    ];
    const computedStyle = window.getComputedStyle(currentNode);
    STYLE_FIELDS.forEach((styleProp) => {
        const propValue = computedStyle.getPropertyValue(styleProp);
        cloneNode.style.setProperty(styleProp, propValue);
    });
    return cloneNode;
}
function cloneSelectedNode(selection, parentNode, parentNodeClone) {
    if (!selection.containsNode(parentNode, true))
        return;
    const range = selection.getRangeAt(0);
    iterateChildNodes(parentNode, (childNode) => {
        if (!selection.containsNode(childNode, true))
            return null;
        const childNodeClone = childNode.cloneNode(false);
        applyComputedStyle(childNode, childNodeClone);
        parentNodeClone.appendChild(childNodeClone);
        if (isTextNode(childNode)) {
            const isStartContainer = childNode === range.startContainer;
            const isEndContainer = childNode === range.endContainer;
            const currentTextContent = childNode.textContent ?? '';
            const startOffset = isStartContainer ? range.startOffset : 0;
            const endOffset = isEndContainer
                ? range.endOffset
                : currentTextContent.length;
            childNodeClone.textContent = currentTextContent.slice(startOffset, endOffset);
        }
        if (isElementNode(childNode)) {
            cloneSelectedNode(selection, childNode, childNodeClone);
        }
        return null;
    });
}
function getSelectedContentAsString(selection) {
    const editableAreaElement = getEditableAreaElement();
    const nodeList = [];
    editableAreaElement.childNodes.forEach((childNode) => {
        if (!selection.containsNode(childNode, true))
            return;
        const childNodeClone = childNode.cloneNode(false);
        applyComputedStyle(childNode, childNodeClone);
        cloneSelectedNode(selection, childNode, childNodeClone);
        nodeList.push(childNodeClone);
    });
    let text = '';
    nodeList.forEach((childElement) => {
        text += childElement.outerHTML;
    });
    return text;
}
function isEditableAreaContainsSelection() {
    const selection = getCurrentSelection();
    if (!selection)
        return false;
    const editableArea = getEditableAreaElement();
    return (editableArea.contains(selection.anchorNode) &&
        editableArea.contains(selection.focusNode));
}

function splitNodeBySelection(node, newRange) {
    const selection = getCurrentSelection();
    if (!selection)
        return null;
    const range = selection.getRangeAt(0);
    const startSelectionNode = range.startContainer;
    const startSelectionOffset = range.startOffset;
    const endSelectionNode = range.endContainer;
    const endSelectionOffset = range.endOffset;
    const containsStartContainer = node.contains(startSelectionNode);
    const containsEndContainer = node.contains(endSelectionNode);
    function createNodeWithTextContent(nodeName, textContent) {
        const element = document.createElement(nodeName);
        element.textContent = textContent;
        return element;
    }
    const resultNodeArray = [];
    if (!containsEndContainer && !containsStartContainer) {
        node.childNodes.forEach((childNode) => {
            resultNodeArray.push(childNode);
        });
    }
    if (containsStartContainer && !containsEndContainer) {
        let isStartFound = false;
        const formattedNodes = [];
        const cleanNodes = [];
        iterateChildNodes(node, (childNode) => {
            const nextNode = childNode.nextSibling;
            if (isTextNode(childNode)) {
                if (childNode === startSelectionNode) {
                    isStartFound = true;
                    const fullText = childNode.textContent ?? '';
                    const formattedTextNode = document.createTextNode(fullText.slice(0, startSelectionOffset));
                    const cleanTextNode = document.createTextNode(fullText.slice(startSelectionOffset));
                    newRange.setStart(cleanTextNode, 0);
                    formattedNodes.push(formattedTextNode);
                    cleanNodes.push(cleanTextNode);
                }
                else {
                    const targetArray = isStartFound ? cleanNodes : formattedNodes;
                    targetArray.push(childNode);
                }
            }
            else {
                const nestedTextNode = childNode.firstChild;
                if (nestedTextNode === startSelectionNode) {
                    isStartFound = true;
                    const fullText = nestedTextNode.textContent ?? '';
                    const formattedTextNode = document.createTextNode(fullText.slice(0, startSelectionOffset));
                    const formattedNode = document.createElement(childNode.nodeName);
                    formattedNode.appendChild(formattedTextNode);
                    formattedNodes.push(formattedNode);
                    const cleanTextNode = document.createTextNode(fullText.slice(startSelectionOffset));
                    newRange.setStart(cleanTextNode, 0);
                    const cleanNode = document.createElement(childNode.nodeName);
                    cleanNode.appendChild(cleanTextNode);
                    cleanNodes.push(cleanNode);
                }
                else {
                    const targetArray = isStartFound ? cleanNodes : formattedNodes;
                    targetArray.push(childNode);
                }
            }
            return nextNode;
        });
        const newNode = document.createElement(node.nodeName);
        formattedNodes.forEach((formattedNode) => {
            newNode.appendChild(formattedNode);
        });
        resultNodeArray.push(newNode, ...cleanNodes);
    }
    if (!containsStartContainer && containsEndContainer) {
        let isEndFound = false;
        const formattedNodes = [];
        const cleanNodes = [];
        iterateChildNodes(node, (childNode) => {
            const nextNode = childNode.nextSibling;
            if (isTextNode(childNode)) {
                if (childNode === endSelectionNode) {
                    isEndFound = true;
                    const fullText = childNode.textContent ?? '';
                    const formattedTextNode = document.createTextNode(fullText.slice(endSelectionOffset));
                    const cleanTextNode = document.createTextNode(fullText.slice(0, endSelectionOffset));
                    newRange.setEnd(cleanTextNode, endSelectionOffset);
                    formattedNodes.push(formattedTextNode);
                    cleanNodes.push(cleanTextNode);
                }
                else {
                    const targetArray = isEndFound ? formattedNodes : cleanNodes;
                    targetArray.push(childNode);
                }
            }
            else {
                const nestedTextNode = childNode.firstChild;
                if (nestedTextNode === endSelectionNode) {
                    isEndFound = true;
                    const fullText = nestedTextNode.textContent ?? '';
                    const formattedTextNode = document.createTextNode(fullText.slice(endSelectionOffset));
                    const formattedNode = document.createElement(childNode.nodeName);
                    formattedNode.appendChild(formattedTextNode);
                    formattedNodes.push(formattedNode);
                    const cleanTextNode = document.createTextNode(fullText.slice(0, endSelectionOffset));
                    newRange.setEnd(cleanTextNode, endSelectionOffset);
                    const cleanNode = document.createElement(childNode.nodeName);
                    cleanNode.appendChild(cleanTextNode);
                    cleanNodes.push(cleanNode);
                }
                else {
                    const targetArray = isEndFound ? formattedNodes : cleanNodes;
                    targetArray.push(childNode);
                }
            }
            return nextNode;
        });
        const newNode = document.createElement(node.nodeName);
        formattedNodes.forEach((formattedNode) => {
            newNode.appendChild(formattedNode);
        });
        resultNodeArray.push(...cleanNodes, newNode);
    }
    if (containsStartContainer && containsEndContainer) {
        let isStartFound = false;
        let isEndFound = false;
        const nodesBeforeSelection = [];
        const nodesInSelection = [];
        const nodesAfterSelection = [];
        iterateChildNodes(node, (childNode) => {
            const nextNode = childNode.nextSibling;
            if (isTextNode(childNode)) {
                const fullText = childNode.textContent ?? '';
                /** node contains two selection ends */
                if (childNode === startSelectionNode &&
                    childNode === endSelectionNode) {
                    isStartFound = true;
                    isEndFound = true;
                    const beforeSelectionTextNode = document.createTextNode(fullText.slice(0, startSelectionOffset));
                    nodesBeforeSelection.push(beforeSelectionTextNode);
                    const inSelectionTextNode = document.createTextNode(fullText.slice(startSelectionOffset, endSelectionOffset));
                    nodesInSelection.push(inSelectionTextNode);
                    const afterSelectionTextNode = document.createTextNode(fullText.slice(endSelectionOffset));
                    nodesAfterSelection.push(afterSelectionTextNode);
                    /** node contains only selection start */
                }
                else if (childNode === startSelectionNode) {
                    isStartFound = true;
                    const beforeSelectionTextNode = document.createTextNode(fullText.slice(0, startSelectionOffset));
                    nodesBeforeSelection.push(beforeSelectionTextNode);
                    const inSelectionTextNode = document.createTextNode(fullText.slice(startSelectionOffset));
                    nodesInSelection.push(inSelectionTextNode);
                    /** node contains only selection end */
                }
                else if (childNode === endSelectionNode) {
                    isEndFound = true;
                    const inSelectionTextNode = document.createTextNode(fullText.slice(0, endSelectionOffset));
                    nodesInSelection.push(inSelectionTextNode);
                    const afterSelectionTextNode = document.createTextNode(fullText.slice(endSelectionOffset));
                    nodesAfterSelection.push(afterSelectionTextNode);
                    /** node doesn't contain any selection end */
                }
                else {
                    const targetArray = !isStartFound
                        ? nodesBeforeSelection
                        : !isEndFound
                            ? nodesInSelection
                            : nodesAfterSelection;
                    targetArray.push(childNode);
                }
            }
            else {
                /** suppose that node has only one child and it's child is text node */
                const nestedTextNode = childNode.firstChild;
                const fullText = childNode.textContent ?? '';
                /** node contains two selection ends */
                if (nestedTextNode === startSelectionNode &&
                    nestedTextNode === endSelectionNode) {
                    isStartFound = true;
                    isEndFound = true;
                    const beforeSelectionNode = createNodeWithTextContent(childNode.nodeName, fullText.slice(0, startSelectionOffset));
                    nodesBeforeSelection.push(beforeSelectionNode);
                    const inSelectionNode = createNodeWithTextContent(childNode.nodeName, fullText.slice(startSelectionOffset, endSelectionOffset));
                    nodesInSelection.push(inSelectionNode);
                    const afterSelectionNode = createNodeWithTextContent(childNode.nodeName, fullText.slice(endSelectionOffset));
                    nodesAfterSelection.push(afterSelectionNode);
                    /** node contains only selection start */
                }
                else if (nestedTextNode === startSelectionNode) {
                    isStartFound = true;
                    const beforeSelectionNode = createNodeWithTextContent(childNode.nodeName, fullText.slice(0, startSelectionOffset));
                    nodesBeforeSelection.push(beforeSelectionNode);
                    const inSelectionNode = createNodeWithTextContent(childNode.nodeName, fullText.slice(startSelectionOffset));
                    nodesInSelection.push(inSelectionNode);
                    /** node contains only selection end */
                }
                else if (nestedTextNode === endSelectionNode) {
                    isEndFound = true;
                    const inSelectionNode = createNodeWithTextContent(childNode.nodeName, fullText.slice(0, endSelectionOffset));
                    nodesInSelection.push(inSelectionNode);
                    const afterSelectionNode = createNodeWithTextContent(childNode.nodeName, fullText.slice(endSelectionOffset));
                    nodesAfterSelection.push(afterSelectionNode);
                    /** node doesn't contain any selection end */
                }
                else {
                    const targetArray = !isStartFound
                        ? nodesBeforeSelection
                        : !isEndFound
                            ? nodesInSelection
                            : nodesAfterSelection;
                    targetArray.push(childNode);
                }
            }
            return nextNode;
        });
        const beforeSelectionNode = document.createElement(node.nodeName);
        nodesBeforeSelection.forEach((childNode) => {
            beforeSelectionNode.appendChild(childNode);
        });
        const afterSelectionNode = document.createElement(node.nodeName);
        nodesAfterSelection.forEach((childNode) => {
            afterSelectionNode.appendChild(childNode);
        });
        resultNodeArray.push(beforeSelectionNode, ...nodesInSelection, afterSelectionNode);
    }
    return resultNodeArray;
}

// eslint-disable-next-line import/prefer-default-export
function walkTreeToUpdateInlineNode(nodeName) {
    const selection = getCurrentSelection();
    if (!selection || selection.rangeCount === 0)
        return;
    const range = selection.getRangeAt(0);
    if (range.collapsed)
        return;
    const containerNode = range.commonAncestorContainer;
    let rootNode = isTextNode(containerNode)
        ? containerNode.parentNode
        : containerNode;
    if (!rootNode)
        return;
    const newRange = document.createRange();
    let shouldClearFormatting = false;
    iterateSelectedNodes((selectedNode) => {
        /**
         * If selection contains node that is already formatted this way - clear formatting
         * e.g. <p>ab|c<strong>1234|567890</strong>def</p>
         */
        if (selectedNode.nodeName === nodeName) {
            shouldClearFormatting = true;
        }
    });
    /**
     * In this case root node is already formatted and contains whole selection,
     * so we should clear formatting
     * e.g. <strong>1234|567|890</strong>
     */
    if (rootNode && rootNode.nodeName === nodeName) {
        rootNode = rootNode.parentNode;
        shouldClearFormatting = true;
    }
    if (!rootNode)
        return;
    function processChild(childNode) {
        if (!rootNode || !selection)
            return null;
        /** skip child until find node where selection starts */
        if (!selection.containsNode(childNode, true))
            return null;
        /** cancel formatting of selected nodes */
        if (shouldClearFormatting) {
            if (childNode.nodeName === nodeName) {
                const parent = childNode.parentNode;
                const nextNode = childNode.nextSibling;
                const newChildren = splitNodeBySelection(childNode, newRange);
                if (parent && newChildren) {
                    newChildren.forEach((newChild) => {
                        parent.insertBefore(newChild, childNode);
                    });
                    parent.removeChild(childNode);
                }
                return nextNode;
            }
            if (childNode.childNodes.length > 0) {
                iterateChildNodes(childNode, processChild);
            }
            return null;
        }
        if (isTextNode(childNode)) {
            const nextSiblingNode = childNode.nextSibling;
            const textNode = childNode;
            const isStartContainer = childNode === range.startContainer;
            const isEndContainer = childNode === range.endContainer;
            const startOffset = isStartContainer ? range.startOffset : 0;
            const endOffset = isEndContainer
                ? range.endOffset
                : (textNode.textContent ?? '').length;
            let selectedTextNode = textNode;
            const wrapperNode = document.createElement(nodeName);
            if (!hasParentWithNodeName(textNode, nodeName)) {
                wrapTextNodeIntoSpecificNode({
                    textNode,
                    wrapperNode,
                    range: {
                        start: startOffset,
                        end: endOffset,
                    },
                });
                selectedTextNode = wrapperNode.firstChild;
            }
            if (isStartContainer && selectedTextNode) {
                newRange.setStart(selectedTextNode, 0);
            }
            if (isEndContainer && selectedTextNode) {
                newRange.setEnd(selectedTextNode, endOffset - startOffset);
            }
            return nextSiblingNode;
        }
        if (childNode.childNodes.length > 0) {
            iterateChildNodes(childNode, processChild);
        }
        return null;
    }
    iterateChildNodes(rootNode, processChild);
    /** save the same selection visually */
    selection.removeRange(range);
    selection.addRange(newRange);
}

// eslint-disable-next-line import/prefer-default-export
function walkTreeToUpdateBlockNode(nodeName) {
    const selection = getCurrentSelection();
    if (!selection || selection.rangeCount === 0)
        return;
    const range = selection.getRangeAt(0);
    const isRangeCollapsed = range.collapsed;
    const rootNode = getEditableAreaElement();
    if (isRangeCollapsed) {
        rootNode.childNodes.forEach((childNode) => {
            if (!selection || !selection.containsNode(childNode, true))
                return;
            const shouldClearFormatting = childNode.nodeName === nodeName;
            const finalNodeName = shouldClearFormatting
                ? NODE_NAMES.PARAGRAPH
                : nodeName;
            if (isBlockNode(childNode)) {
                replaceNodeName(childNode, finalNodeName, rootNode);
            }
        });
    }
    else {
        const startSelectionNode = range.startContainer;
        const startSelectionOffset = range.startOffset;
        const endSelectionNode = range.endContainer;
        const endSelectionOffset = range.endOffset;
        iterateChildNodes(rootNode, (blockNode) => {
            if (!selection || !selection.containsNode(blockNode, true))
                return null;
            const shouldClearFormatting = blockNode.nodeName === nodeName;
            const finalNodeName = shouldClearFormatting
                ? NODE_NAMES.PARAGRAPH
                : nodeName;
            const nextNode = blockNode.nextSibling;
            const containsSelectionStart = blockNode.contains(startSelectionNode);
            const containsSelectionEnd = blockNode.contains(endSelectionNode);
            let beforeSelectionPart = null;
            let inSelectionPart = null;
            let afterSelectionPart = null;
            if (!containsSelectionStart && !containsSelectionEnd) {
                inSelectionPart = blockNode;
            }
            else if (containsSelectionStart && !containsSelectionEnd) {
                const [left, right] = splitNodeByTextNode({
                    ancestorNode: blockNode,
                    dividerTextNode: startSelectionNode,
                    dividerTextOffset: startSelectionOffset,
                });
                beforeSelectionPart = left;
                inSelectionPart = right;
            }
            else if (!containsSelectionStart && containsSelectionEnd) {
                const [left, right] = splitNodeByTextNode({
                    ancestorNode: blockNode,
                    dividerTextNode: endSelectionNode,
                    dividerTextOffset: endSelectionOffset,
                });
                inSelectionPart = left;
                afterSelectionPart = right;
            }
            else if (containsSelectionStart && containsSelectionEnd) {
                beforeSelectionPart = cloneOneSideOfNodeTree({
                    ancestorNode: blockNode,
                    dividerTextNode: startSelectionNode,
                    dividerTextOffset: startSelectionOffset,
                    cloneDirection: 'left',
                });
                afterSelectionPart = cloneOneSideOfNodeTree({
                    ancestorNode: blockNode,
                    dividerTextNode: endSelectionNode,
                    dividerTextOffset: endSelectionOffset,
                    cloneDirection: 'right',
                });
                inSelectionPart = removeOneSideOfTree({
                    ancestorNode: blockNode,
                    dividerTextNode: endSelectionNode,
                    dividerTextOffset: endSelectionOffset,
                    removeDirection: 'right',
                });
                inSelectionPart = removeOneSideOfTree({
                    ancestorNode: blockNode,
                    dividerTextNode: startSelectionNode,
                    dividerTextOffset: startSelectionOffset,
                    removeDirection: 'left',
                });
            }
            function isNodeWithContentGuard(node) {
                return Boolean(node && node.textContent);
            }
            const isSelectionPartStatic = inSelectionPart !== blockNode;
            if (inSelectionPart && isSelectionPartStatic) {
                inSelectionPart = replaceNameOfStaticNode(inSelectionPart, finalNodeName);
                rootNode.removeChild(blockNode);
            }
            if (inSelectionPart && !isSelectionPartStatic) {
                const replacedBlockNode = replaceNodeName(blockNode, finalNodeName, rootNode);
                inSelectionPart = replacedBlockNode.cloneNode(true);
                rootNode.removeChild(replacedBlockNode);
            }
            const finalChildren = [
                beforeSelectionPart,
                inSelectionPart,
                afterSelectionPart,
            ].filter(isNodeWithContentGuard);
            finalChildren.forEach((child) => {
                rootNode.insertBefore(child, nextNode);
            });
            return nextNode;
        });
    }
}

document.addEventListener('selectionchange', () => {
    const selection = getCurrentSelection();
    if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        updateButtonActiveStatus(range);
    }
});
const EDITABLE_AREA_ELEMENT = getEditableAreaElement();
function ensureAllBlocksAreStyledCorrectly() {
    function applyStyleForEachChild(parent) {
        iterateChildNodes(parent, (childNode) => {
            setStyleToElement(childNode);
            applyStyleForEachChild(childNode);
            return null;
        });
    }
    requestAnimationFrame(() => applyStyleForEachChild(EDITABLE_AREA_ELEMENT));
}
function isFakeBoldNode(node) {
    if (!isElementNode(node))
        return false;
    const element = node;
    const isSpan = element.nodeName === 'SPAN';
    const hasBoldClass = element.classList.contains(CLASS_MAP[NODE_NAMES.BOLD]);
    const hasBoldStyle = ['bold', '700'].includes(element.style.fontWeight);
    return isSpan && (hasBoldClass || hasBoldStyle);
}
function isFakeItalicNode(node) {
    if (!isElementNode(node))
        return false;
    const element = node;
    const isSpan = element.nodeName === 'SPAN';
    const hasItalicClass = element.classList.contains(CLASS_MAP[NODE_NAMES.ITALIC]);
    const hasItalicStyle = element.style.fontStyle === 'italic';
    return isSpan && (hasItalicClass || hasItalicStyle);
}
EDITABLE_AREA_ELEMENT.addEventListener('copy', (event) => {
    const selection = getCurrentSelection();
    if (!selection)
        return;
    const selectedContentAsString = getSelectedContentAsString(selection);
    if (selectedContentAsString && event.clipboardData) {
        event.clipboardData.setData('text/plain', selection.toString());
        event.clipboardData.setData('text/html', selectedContentAsString);
        event.preventDefault();
    }
});
EDITABLE_AREA_ELEMENT.addEventListener('cut', (event) => {
    const selection = getCurrentSelection();
    if (!selection)
        return;
    const selectedContentAsString = getSelectedContentAsString(selection);
    if (selectedContentAsString && event.clipboardData) {
        event.clipboardData.setData('text/plain', selection.toString());
        event.clipboardData.setData('text/html', selectedContentAsString);
        selection.deleteFromDocument();
        /**
         * Remove child if it doesn't have any text content
         * Browser may leave a couple of empty tags after cut
         */
        iterateChildNodes(EDITABLE_AREA_ELEMENT, (childNode) => {
            const nextNode = childNode.nextSibling;
            if (!childNode.textContent) {
                EDITABLE_AREA_ELEMENT.removeChild(childNode);
            }
            return nextNode;
        });
        event.preventDefault();
    }
});
/** Browser can replace <strong> with <span> */
function filterChildren(parentNode) {
    iterateChildNodes(parentNode, (childNode) => {
        const nextChildNode = childNode.nextSibling;
        let currentNode = childNode;
        if (isFakeBoldNode(currentNode)) {
            currentNode = replaceNodeName(childNode, NODE_NAMES.BOLD, parentNode);
        }
        else if (isFakeItalicNode(currentNode)) {
            currentNode = replaceNodeName(childNode, NODE_NAMES.ITALIC, parentNode);
        }
        else if (currentNode.nodeName === 'SPAN') {
            iterateChildNodes(childNode, (innerNestedChild) => {
                const nextInnerNestedChild = innerNestedChild.nextSibling;
                parentNode.insertBefore(innerNestedChild, childNode);
                return nextInnerNestedChild;
            });
            parentNode.removeChild(childNode);
            return nextChildNode;
        }
        filterChildren(currentNode);
        return nextChildNode;
    });
}
/** browser can remove some styles when paste content in editor */
EDITABLE_AREA_ELEMENT.addEventListener('paste', () => {
    requestAnimationFrame(() => {
        iterateChildNodes(EDITABLE_AREA_ELEMENT, (childNode) => {
            const hasNestedBlockNode = isBlockNode(childNode) &&
                childNode.firstChild &&
                isBlockNode(childNode.firstChild);
            filterChildren(childNode);
            if (hasNestedBlockNode) {
                const nextNode = childNode.nextSibling;
                iterateChildNodes(childNode, (nestedChild) => {
                    const nextNestedChild = nestedChild.nextSibling;
                    EDITABLE_AREA_ELEMENT.insertBefore(nestedChild, childNode);
                    return nextNestedChild;
                });
                EDITABLE_AREA_ELEMENT.removeChild(childNode);
                return nextNode;
            }
            return null;
        });
        EDITABLE_AREA_ELEMENT.normalize();
        ensureAllBlocksAreStyledCorrectly();
    });
});
/** by default there are no any initial element inside editor */
EDITABLE_AREA_ELEMENT.addEventListener('focus', () => {
    if (EDITABLE_AREA_ELEMENT.children.length === 0) {
        insertEmptyParagraphAndFocus(EDITABLE_AREA_ELEMENT);
    }
});
const mutationObserver = new MutationObserver((mutations) => {
    if (EDITABLE_AREA_ELEMENT.children.length === 0) {
        insertEmptyParagraphAndFocus(EDITABLE_AREA_ELEMENT);
    }
    else {
        const latestMutation = mutations[mutations.length - 1];
        /** When user adds new line browser creates <div> element by default. I replace <div> with <p> */
        latestMutation.addedNodes.forEach((addedNode) => {
            if (isElementNode(addedNode) && !isBlockNode(addedNode)) {
                const replacedNode = replaceNodeName(addedNode, NODE_NAMES.PARAGRAPH, EDITABLE_AREA_ELEMENT);
                setStyleToElement(replacedNode);
            }
            /** Fix typing start in Firefox */
            if (isTextNode(addedNode)) {
                const paragraph = document.createElement(NODE_NAMES.PARAGRAPH);
                const text = addedNode.textContent ?? '';
                paragraph.textContent = text;
                replaceNode(addedNode, paragraph, EDITABLE_AREA_ELEMENT);
                const selection = getCurrentSelection();
                if (selection) {
                    const range = document.createRange();
                    range.setStart(paragraph, text.length);
                    range.setEnd(paragraph, text.length);
                    selection.removeAllRanges();
                    selection.addRange(range);
                }
            }
        });
        filterChildren(EDITABLE_AREA_ELEMENT);
    }
});
mutationObserver.observe(EDITABLE_AREA_ELEMENT, { childList: true });
/** Listen toolkit button clicks */
document.querySelectorAll(`button[data-command]`).forEach((button) => {
    const nodeName = (button.getAttribute('data-command') ?? '').toUpperCase();
    if (isBlockNodeName(nodeName)) {
        button.addEventListener('click', () => {
            if (!isEditableAreaContainsSelection())
                return;
            walkTreeToUpdateBlockNode(nodeName);
            ensureAllBlocksAreStyledCorrectly();
        });
    }
    if (isInlineNodeName(nodeName)) {
        button.addEventListener('click', () => {
            if (!isEditableAreaContainsSelection())
                return;
            walkTreeToUpdateInlineNode(nodeName);
            ensureAllBlocksAreStyledCorrectly();
        });
    }
});
