const NODE_NAMES = {
    H1: 'H1',
    H2: 'H2',
    PARAGRAPH: 'P',
    BOLD: 'STRONG',
    ITALIC: 'I',
};
const BLOCK_NODES = [NODE_NAMES.H1, NODE_NAMES.H2, NODE_NAMES.PARAGRAPH];
const INLINE_NODES = [NODE_NAMES.BOLD, NODE_NAMES.ITALIC];

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
        return;
    const newNode = document.createElement(newNodeName);
    replaceNode(oldNode, newNode, parentNode);
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
    const startSelectionNode = range.startContainer;
    const startSelectionOffset = range.startOffset;
    const endSelectionNode = range.endContainer;
    const endSelectionOffset = range.endOffset;
    const rootNode = getEditableAreaElement();
    const shouldClearFormatting = Array.from(rootNode.childNodes).some((childNode) => childNode.nodeName === nodeName);
    function checkChild(childNode, parentNode) {
        if (!selection || !selection.containsNode(childNode, true))
            return;
        if (isBlockNode(childNode)) {
            replaceNodeName(childNode, shouldClearFormatting ? NODE_NAMES.PARAGRAPH : nodeName, parentNode);
        }
    }
    rootNode.childNodes.forEach((child) => checkChild(child, rootNode));
    /** save the same selection visually */
    const newRange = document.createRange();
    newRange.setStart(startSelectionNode, startSelectionOffset);
    newRange.setEnd(endSelectionNode, endSelectionOffset);
    selection.removeRange(range);
    selection.addRange(newRange);
}

document.addEventListener('selectionchange', () => {
    const selection = getCurrentSelection();
    if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        updateButtonActiveStatus(range);
    }
});
const EDITABLE_AREA_ELEMENT = getEditableAreaElement();
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
        latestMutation.addedNodes.forEach((addedNode) => {
            if (!isBlockNode(addedNode)) {
                replaceNodeName(addedNode, NODE_NAMES.PARAGRAPH, EDITABLE_AREA_ELEMENT);
            }
        });
    }
});
mutationObserver.observe(EDITABLE_AREA_ELEMENT, { childList: true });
/** Listen toolkit button clicks */
document.querySelectorAll(`button[data-command]`).forEach((button) => {
    const nodeName = (button.getAttribute('data-command') ?? '').toUpperCase();
    if (isBlockNodeName(nodeName)) {
        button.addEventListener('click', () => {
            walkTreeToUpdateBlockNode(nodeName);
        });
    }
    if (isInlineNodeName(nodeName)) {
        button.addEventListener('click', () => {
            walkTreeToUpdateInlineNode(nodeName);
        });
    }
});
