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
  isElementNode,
  getSelectedContentAsString,
  isTextNode,
  replaceNode,
  isEditableAreaContainsSelection,
} from './utils/common';
import { CLASS_MAP, NODE_NAMES } from './constants';
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

function isFakeBoldNode(node: Node): boolean {
  if (!isElementNode(node)) return false;

  const element = node as HTMLElement;

  const isSpan = element.nodeName === 'SPAN';
  const hasBoldClass = element.classList.contains(CLASS_MAP[NODE_NAMES.BOLD]);
  const hasBoldStyle = ['bold', '700'].includes(element.style.fontWeight);

  return isSpan && (hasBoldClass || hasBoldStyle);
}

function isFakeItalicNode(node: Node): boolean {
  if (!isElementNode(node)) return false;

  const element = node as HTMLElement;

  const isSpan = element.nodeName === 'SPAN';
  const hasItalicClass = element.classList.contains(
    CLASS_MAP[NODE_NAMES.ITALIC]
  );
  const hasItalicStyle = element.style.fontStyle === 'italic';

  return isSpan && (hasItalicClass || hasItalicStyle);
}

EDITABLE_AREA_ELEMENT.addEventListener('copy', (event: ClipboardEvent) => {
  const selection = getCurrentSelection();
  if (!selection) return;

  const selectedContentAsString = getSelectedContentAsString(selection);

  if (selectedContentAsString && event.clipboardData) {
    event.clipboardData.setData('text/plain', selection.toString());
    event.clipboardData.setData('text/html', selectedContentAsString);

    event.preventDefault();
  }
});

EDITABLE_AREA_ELEMENT.addEventListener('cut', (event: ClipboardEvent) => {
  const selection = getCurrentSelection();
  if (!selection) return;

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
function filterChildren(parentNode: Node) {
  iterateChildNodes(parentNode, (childNode) => {
    const nextChildNode = childNode.nextSibling;
    let currentNode = childNode;

    if (isFakeBoldNode(currentNode)) {
      currentNode = replaceNodeName(childNode, NODE_NAMES.BOLD, parentNode);
    } else if (isFakeItalicNode(currentNode)) {
      currentNode = replaceNodeName(childNode, NODE_NAMES.ITALIC, parentNode);
    } else if (currentNode.nodeName === 'SPAN') {
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
      const hasNestedBlockNode =
        isBlockNode(childNode) &&
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
  } else {
    const latestMutation = mutations[mutations.length - 1];

    /** When user adds new line browser creates <div> element by default. I replace <div> with <p> */
    latestMutation.addedNodes.forEach((addedNode) => {
      if (isElementNode(addedNode) && !isBlockNode(addedNode)) {
        const replacedNode = replaceNodeName(
          addedNode,
          NODE_NAMES.PARAGRAPH,
          EDITABLE_AREA_ELEMENT
        );
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
      if (!isEditableAreaContainsSelection()) return;

      walkTreeToUpdateBlockNode(nodeName);
      ensureAllBlocksAreStyledCorrectly();
    });
  }

  if (isInlineNodeName(nodeName)) {
    button.addEventListener('click', () => {
      if (!isEditableAreaContainsSelection()) return;

      walkTreeToUpdateInlineNode(nodeName);
      ensureAllBlocksAreStyledCorrectly();
    });
  }
});
