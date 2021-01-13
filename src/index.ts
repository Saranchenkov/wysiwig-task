import {
  getCurrentSelection,
  getEditableAreaElement,
  insertEmptyParagraphAndFocus,
  isBlockNode,
  isBlockNodeName,
  isInlineNodeName,
  replaceNodeName,
  updateButtonActiveStatus,
} from './utils/common';
import { NODE_NAMES } from './constants';
import { walkTreeToUpdateInlineNode } from './utils/inlineElements';
import { walkTreeToUpdateBlockNode } from './utils/blockElements';

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
      requestAnimationFrame(() => walkTreeToUpdateInlineNode(nodeName));
    });
  }
});
