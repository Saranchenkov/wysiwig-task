import {
  getCurrentSelection,
  getEditableAreaElement,
  hasParentWithNodeName,
  insertEmptyParagraphAndFocus,
  isBlockNode,
  isBlockNodeName,
  isInlineNodeName,
  isTextNode,
  iterateChildNodes,
  replaceNodeName,
  updateButtonActiveStatus,
  wrapTextNodeIntoSpecificNode,
} from './utils';
import { NODE_NAMES } from './constants';

let selection = getCurrentSelection();

document.addEventListener('selectionchange', () => {
  selection = getCurrentSelection();

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
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);

  if (range.collapsed) return;

  const containerNode = range.commonAncestorContainer;

  const rootNode = isTextNode(containerNode)
    ? containerNode.parentNode
    : containerNode;

  if (!rootNode) return;

  const newRange = document.createRange();

  function checkChild(childNode: Node): Node | null {
    if (!rootNode || !selection) return null;

    /** skip child until find node where selection starts */
    if (!selection.containsNode(childNode, true)) return null;

    if (isTextNode(childNode)) {
      const nextSiblingNode = childNode.nextSibling;
      const textNode = childNode;

      const isStartContainer = childNode === range.startContainer;
      const isEndContainer = childNode === range.endContainer;

      const startOffset = isStartContainer ? range.startOffset : 0;
      const endOffset = isEndContainer
        ? range.endOffset
        : (textNode.textContent ?? '').length;

      let selectedTextNode: Node | null = textNode;

      const wrapperNode = document.createElement(nodeName);

      if (!hasParentWithNodeName(textNode, nodeName)) {
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

      return nextSiblingNode;
    }

    if (childNode.childNodes.length > 0) {
      iterateChildNodes(childNode, checkChild);
    }

    return null;
  }

  iterateChildNodes(rootNode, checkChild);

  /** save the same selection visually */
  selection.removeRange(range);
  selection.addRange(newRange);
}

function walkTreeToUpdateBlockNode(nodeName: string): void {
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);

  const startSelectionNode = range.startContainer;
  const startSelectionOffset = range.startOffset;
  const endSelectionNode = range.endContainer;
  const endSelectionOffset = range.endOffset;

  const rootNode = EDITABLE_AREA_ELEMENT;

  if (!rootNode) return;

  function checkChild(childNode: Node, parentNode: Node): void {
    if (!rootNode || !selection || !selection.containsNode(childNode)) return;

    if (isBlockNode(childNode)) {
      replaceNodeName(childNode, nodeName, parentNode);
    } else if (childNode.childNodes.length > 0) {
      childNode.childNodes.forEach((nestedChild) =>
        checkChild(nestedChild, childNode)
      );
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
      requestAnimationFrame(() => walkTreeToUpdateInlineNode(nodeName));
    });
  }
});
