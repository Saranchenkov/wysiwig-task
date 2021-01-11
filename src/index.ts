import {
  getCurrentSelection,
  getEditableAreaElement,
  hasParentWithNodeName,
  insertEmptyParagraphAndFocus,
  isBlockNode,
  isBlockNodeName,
  isInlineNodeName,
  isTextNode,
  replaceNodeName,
  updateButtonActiveStatus,
  wrapTextNodeIntoSpecificNode,
} from './utils';
import { NODE_NAMES } from './constants';

let selection = getCurrentSelection();

document.addEventListener('selectionchange', () => {
  selection = getCurrentSelection();

  if (selection) {
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
  } else {
    const latestMutation = mutations[mutations.length - 1];
    latestMutation.addedNodes.forEach((addedNode) => {
      if (!isBlockNode(addedNode)) {
        replaceNodeName(addedNode, NODE_NAMES.PARAGRAPH, EDITABLE_AREA_ELEMENT);
      }
    });
  }
});

mutationObserver.observe(EDITABLE_AREA_ELEMENT, { childList: true });

function walkTreeToUpdateInlineNode(nodeName: string): void {
  if (!selection) return;
  const range = selection.getRangeAt(0);

  if (range.collapsed) return;

  const containerNode = range.commonAncestorContainer;

  const rootNode = isTextNode(containerNode)
    ? containerNode.parentNode
    : containerNode;

  if (!rootNode) return;

  let isStartContainerFound = false;
  let isEndContainerFound = false;

  const newRange = document.createRange();

  function checkChild(childNode: Node): void {
    if (!rootNode) return;
    if (isEndContainerFound) return;

    /** skip child until find node where selection starts */
    if (!isStartContainerFound && !childNode.contains(range.startContainer))
      return;

    if (childNode === range.startContainer) {
      isStartContainerFound = true;
    }

    if (childNode === range.endContainer) {
      isEndContainerFound = true;
    }

    if (isTextNode(childNode)) {
      const textNode = childNode;

      const isStartContainer = childNode === range.startContainer;
      const isEndContainer = childNode === range.endContainer;

      const startOffset = isStartContainer ? range.startOffset : 0;
      const endOffset = isEndContainer
        ? range.endOffset
        : (textNode.textContent ?? '').length;

      let selectedTextNode: Node | null = textNode;

      if (!hasParentWithNodeName(textNode, nodeName)) {
        const wrapperNode = document.createElement(nodeName);

        wrapTextNodeIntoSpecificNode({
          textNode,
          range: {
            start: startOffset,
            end: endOffset,
          },
          wrapperNode,
        });

        selectedTextNode = wrapperNode.firstChild;
      }

      if (isStartContainer && selectedTextNode) {
        newRange.setStart(selectedTextNode, 0);
      }

      if (isEndContainer && selectedTextNode) {
        newRange.setEnd(selectedTextNode, endOffset - startOffset);
      }
    } else if (childNode.childNodes.length > 0) {
      childNode.childNodes.forEach(checkChild);
    }
  }

  rootNode.childNodes.forEach(checkChild);

  /** save the same selection visually */
  selection.removeRange(range);
  selection.addRange(newRange);
}

function walkTreeToUpdateBlockNode(nodeName: string): void {
  if (!selection) return;
  const range = selection.getRangeAt(0);

  const startSelectionNode = range.startContainer;
  const startSelectionOffset = range.startOffset;
  const endSelectionNode = range.endContainer;
  const endSelectionOffset = range.endOffset;

  const rootNode = EDITABLE_AREA_ELEMENT;

  if (!rootNode) return;

  let isStartContainerFound = false;
  let isEndContainerFound = false;

  function checkChild(childNode: Node, parentNode: Node): void {
    if (!rootNode) return;
    if (isEndContainerFound) return;

    /** skip child until find node where selection starts */
    if (!isStartContainerFound && !childNode.contains(startSelectionNode)) {
      return;
    }

    if (childNode.contains(range.startContainer)) {
      isStartContainerFound = true;
    }

    if (childNode.contains(range.endContainer)) {
      isEndContainerFound = true;
    }

    if (isBlockNode(childNode)) {
      replaceNodeName(childNode, nodeName, parentNode);
    } else if (childNode.childNodes.length > 0) {
      childNode.childNodes.forEach((child) => checkChild(child, childNode));
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

/** Listen toolkit button clicks */
document.querySelectorAll(`button[data-command]`).forEach((button) => {
  const nodeName = button.getAttribute('data-command') ?? '';

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
