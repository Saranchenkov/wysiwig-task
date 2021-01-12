import {
  getCurrentSelection,
  hasParentWithNodeName,
  isTextNode,
  iterateChildNodes,
  iterateSelectedNodes,
  wrapTextNodeIntoSpecificNode,
} from './commonUtils';

// eslint-disable-next-line import/prefer-default-export
export function walkTreeToUpdateInlineNode(nodeName: string): void {
  const selection = getCurrentSelection();

  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);

  if (range.collapsed) return;

  const containerNode = range.commonAncestorContainer;

  const rootNode = isTextNode(containerNode)
    ? containerNode.parentNode
    : containerNode;

  if (!rootNode) return;

  let shouldClearFormatting = false;

  iterateSelectedNodes((selectedNode) => {
    /** If selection contains node that is already formatted this way - clear formatting */
    if (selectedNode.nodeName === nodeName) {
      shouldClearFormatting = true;
    }
  });

  const newRange = document.createRange();

  function checkChild(childNode: Node): Node | null {
    if (!rootNode || !selection) return null;

    /** skip child until find node where selection starts */
    if (!selection.containsNode(childNode, true)) return null;

    // debugger;
    // if (shouldClearFormatting) {
    //   if (childNode.nodeName !== nodeName) return null;
    //
    //   const parent = childNode.parentNode;
    //   const nextNode = childNode.nextSibling;
    //
    //   if (parent) {
    //     iterateChildNodes(childNode, (nestedChild) => {
    //       const nextNestedChild = nestedChild.nextSibling;
    //
    //       if (nestedChild.textContent) {
    //         parent.insertBefore(nestedChild, childNode);
    //       }
    //
    //       return nextNestedChild;
    //     });
    //
    //     parent.removeChild(childNode);
    //
    //     return nextNode;
    //   }
    //
    //   return null;
    // }

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
