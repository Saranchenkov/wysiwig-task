import {
  getCurrentSelection,
  getEditableAreaElement,
  isBlockNode,
  replaceNodeName,
  cloneOneSideOfNodeTree,
  removeOneSideOfTree,
  iterateChildNodes,
  splitNodeByTextNode,
  replaceNameOfStaticNode,
} from './common';
import { NODE_NAMES } from '../constants';

// eslint-disable-next-line import/prefer-default-export
export function walkTreeToUpdateBlockNode(nodeName: string): void {
  const selection = getCurrentSelection();

  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);

  const isRangeCollapsed = range.collapsed;

  const rootNode = getEditableAreaElement();

  if (isRangeCollapsed) {
    rootNode.childNodes.forEach((childNode) => {
      if (!selection || !selection.containsNode(childNode, true)) return;

      const shouldClearFormatting = childNode.nodeName === nodeName;
      const finalNodeName = shouldClearFormatting
        ? NODE_NAMES.PARAGRAPH
        : nodeName;

      if (isBlockNode(childNode)) {
        replaceNodeName(childNode, finalNodeName, rootNode);
      }
    });
  } else {
    const startSelectionNode = range.startContainer;
    const startSelectionOffset = range.startOffset;
    const endSelectionNode = range.endContainer;
    const endSelectionOffset = range.endOffset;

    iterateChildNodes(rootNode, (blockNode) => {
      if (!selection || !selection.containsNode(blockNode, true)) return null;

      const shouldClearFormatting = blockNode.nodeName === nodeName;
      const finalNodeName = shouldClearFormatting
        ? NODE_NAMES.PARAGRAPH
        : nodeName;

      const nextNode = blockNode.nextSibling;

      const containsSelectionStart = blockNode.contains(startSelectionNode);
      const containsSelectionEnd = blockNode.contains(endSelectionNode);

      let beforeSelectionPart: Node | null = null;
      let inSelectionPart: Node | null = null;
      let afterSelectionPart: Node | null = null;

      if (!containsSelectionStart && !containsSelectionEnd) {
        inSelectionPart = blockNode;
      } else if (containsSelectionStart && !containsSelectionEnd) {
        const [left, right] = splitNodeByTextNode({
          ancestorNode: blockNode as Element,
          dividerTextNode: startSelectionNode,
          dividerTextOffset: startSelectionOffset,
        });

        beforeSelectionPart = left;
        inSelectionPart = right;
      } else if (!containsSelectionStart && containsSelectionEnd) {
        const [left, right] = splitNodeByTextNode({
          ancestorNode: blockNode as Element,
          dividerTextNode: endSelectionNode,
          dividerTextOffset: endSelectionOffset,
        });

        inSelectionPart = left;
        afterSelectionPart = right;
      } else if (containsSelectionStart && containsSelectionEnd) {
        beforeSelectionPart = cloneOneSideOfNodeTree({
          ancestorNode: blockNode as Element,
          dividerTextNode: startSelectionNode,
          dividerTextOffset: startSelectionOffset,
          cloneDirection: 'left',
        });
        afterSelectionPart = cloneOneSideOfNodeTree({
          ancestorNode: blockNode as Element,
          dividerTextNode: endSelectionNode,
          dividerTextOffset: endSelectionOffset,
          cloneDirection: 'right',
        });

        inSelectionPart = removeOneSideOfTree({
          ancestorNode: blockNode as Element,
          dividerTextNode: endSelectionNode,
          dividerTextOffset: endSelectionOffset,
          removeDirection: 'right',
        });

        inSelectionPart = removeOneSideOfTree({
          ancestorNode: blockNode as Element,
          dividerTextNode: startSelectionNode,
          dividerTextOffset: startSelectionOffset,
          removeDirection: 'left',
        });
      }

      function isNodeWithContentGuard(node: Node | null): node is Node {
        return Boolean(node && node.textContent);
      }

      const isSelectionPartStatic = inSelectionPart !== blockNode;

      if (inSelectionPart && isSelectionPartStatic) {
        inSelectionPart = replaceNameOfStaticNode(
          inSelectionPart,
          finalNodeName
        );
        rootNode.removeChild(blockNode);
      }

      if (inSelectionPart && !isSelectionPartStatic) {
        const replacedBlockNode = replaceNodeName(
          blockNode,
          finalNodeName,
          rootNode
        );
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
