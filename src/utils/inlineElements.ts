import {
  getCurrentSelection,
  hasParentWithNodeName,
  isTextNode,
  iterateChildNodes,
  iterateSelectedNodes,
  wrapTextNodeIntoSpecificNode,
} from './common';
import { splitNodeBySelection } from './splitNodeBySelection';

// eslint-disable-next-line import/prefer-default-export
export function walkTreeToUpdateInlineNode(nodeName: string): void {
  const selection = getCurrentSelection();

  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);

  if (range.collapsed) return;

  const containerNode = range.commonAncestorContainer;

  let rootNode = isTextNode(containerNode)
    ? containerNode.parentNode
    : containerNode;

  if (!rootNode) return;

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

  if (!rootNode) return;

  function processChild(childNode: Node): Node | null {
    if (!rootNode || !selection) return null;

    /** skip child until find node where selection starts */
    if (!selection.containsNode(childNode, true)) return null;

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

      let selectedTextNode: Node | null = textNode;

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
