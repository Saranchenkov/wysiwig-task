import {
  setStyleToElement,
  getCurrentSelection,
  getEditableAreaElement,
  insertEmptyParagraphAndFocus,
  isBlockNode,
  isBlockNodeName,
  isInlineNodeName,
  iterateChildNodes,
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

function ensureAllBlocksAreStyledCorrectly() {
  function applyStyleForEachChild(parent: Node) {
    iterateChildNodes(parent, (childNode) => {
      setStyleToElement(childNode);

      applyStyleForEachChild(childNode);

      return null;
    });
  }

  requestAnimationFrame(() => applyStyleForEachChild(EDITABLE_AREA_ELEMENT));
}

/** browser can remove some styles when paste content in editor */
EDITABLE_AREA_ELEMENT.addEventListener('paste', () => {
  requestAnimationFrame(() => {
    iterateChildNodes(EDITABLE_AREA_ELEMENT, (childNode) => {
      const hasNestedBlockNode =
        isBlockNode(childNode) &&
        childNode.firstChild &&
        isBlockNode(childNode.firstChild);

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
  } else {
    const latestMutation = mutations[mutations.length - 1];

    /** When user adds new line browser creates <div> element by default. I replace <div> with <p> */
    latestMutation.addedNodes.forEach((addedNode) => {
      if (!isBlockNode(addedNode)) {
        const replacedNode = replaceNodeName(
          addedNode,
          NODE_NAMES.PARAGRAPH,
          EDITABLE_AREA_ELEMENT
        );
        setStyleToElement(replacedNode);
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

    ensureAllBlocksAreStyledCorrectly();
  }

  if (isInlineNodeName(nodeName)) {
    button.addEventListener('click', () => {
      walkTreeToUpdateInlineNode(nodeName);
    });

    ensureAllBlocksAreStyledCorrectly();
  }
});
