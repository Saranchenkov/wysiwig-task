import {
  applyStylesForNode,
  getCurrentSelection,
  getEditableAreaElement,
  isBlockNode,
  replaceNodeName,
} from './common';
import { NODE_NAMES } from '../constants';

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

  function checkChild(childNode: Node, parentNode: Node): void {
    if (!selection || !selection.containsNode(childNode, true)) return;

    const shouldClearFormatting = childNode.nodeName === nodeName;

    if (isBlockNode(childNode)) {
      const finalNodeName = shouldClearFormatting
        ? NODE_NAMES.PARAGRAPH
        : nodeName;
      const replacedNode = replaceNodeName(
        childNode,
        finalNodeName,
        parentNode
      );
      applyStylesForNode(replacedNode as HTMLElement);
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
