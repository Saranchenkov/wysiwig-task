import {
  getCurrentSelection,
  getEditableAreaElement,
  isBlockNode,
  replaceNodeName,
} from './commonUtils';
import { NODE_NAMES } from './constants';

// eslint-disable-next-line import/prefer-default-export
export function walkTreeToUpdateBlockNode(nodeName: string): void {
  const selection = getCurrentSelection();

  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);

  const startSelectionNode = range.startContainer;
  const startSelectionOffset = range.startOffset;
  const endSelectionNode = range.endContainer;
  const endSelectionOffset = range.endOffset;

  const rootNode = getEditableAreaElement();

  const shouldClearFormatting = Array.from(rootNode.childNodes).some(
    (childNode) => childNode.nodeName === nodeName
  );

  function checkChild(childNode: Node, parentNode: Node): void {
    if (!selection || !selection.containsNode(childNode, true)) return;

    if (isBlockNode(childNode)) {
      replaceNodeName(
        childNode,
        shouldClearFormatting ? NODE_NAMES.PARAGRAPH : nodeName,
        parentNode
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
