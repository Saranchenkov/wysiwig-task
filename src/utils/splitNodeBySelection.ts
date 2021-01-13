import { getCurrentSelection, isTextNode, iterateChildNodes } from './common';

export function splitNodeBySelection(
  node: Node,
  newRange: Range
): Array<Node> | null {
  const selection = getCurrentSelection();
  if (!selection) return null;

  const range = selection.getRangeAt(0);

  const startSelectionNode = range.startContainer;
  const startSelectionOffset = range.startOffset;

  const endSelectionNode = range.endContainer;
  const endSelectionOffset = range.endOffset;

  const containsStartContainer = node.contains(startSelectionNode);
  const containsEndContainer = node.contains(endSelectionNode);

  function createNodeWithTextContent(
    nodeName: string,
    textContent: string
  ): Node {
    const element = document.createElement(nodeName);
    element.textContent = textContent;

    return element;
  }

  const resultNodeArray: Array<Node> = [];

  if (!containsEndContainer && !containsStartContainer) {
    node.childNodes.forEach((childNode) => {
      resultNodeArray.push(childNode);
    });
  }

  if (containsStartContainer && !containsEndContainer) {
    let isStartFound = false;
    const formattedNodes: Array<Node> = [];
    const cleanNodes: Array<Node> = [];

    iterateChildNodes(node, (childNode) => {
      const nextNode = childNode.nextSibling;

      if (isTextNode(childNode)) {
        if (childNode === startSelectionNode) {
          isStartFound = true;
          const fullText = childNode.textContent ?? '';
          const formattedTextNode = document.createTextNode(
            fullText.slice(0, startSelectionOffset)
          );
          const cleanTextNode = document.createTextNode(
            fullText.slice(startSelectionOffset)
          );

          newRange.setStart(cleanTextNode, 0);

          formattedNodes.push(formattedTextNode);
          cleanNodes.push(cleanTextNode);
        } else {
          const targetArray = isStartFound ? cleanNodes : formattedNodes;
          targetArray.push(childNode);
        }
      } else {
        const nestedTextNode = childNode.firstChild;

        if (nestedTextNode === startSelectionNode) {
          isStartFound = true;
          const fullText = nestedTextNode.textContent ?? '';

          const formattedTextNode = document.createTextNode(
            fullText.slice(0, startSelectionOffset)
          );
          const formattedNode = document.createElement(childNode.nodeName);
          formattedNode.appendChild(formattedTextNode);

          formattedNodes.push(formattedNode);

          const cleanTextNode = document.createTextNode(
            fullText.slice(startSelectionOffset)
          );
          newRange.setStart(cleanTextNode, 0);

          const cleanNode = document.createElement(childNode.nodeName);
          cleanNode.appendChild(cleanTextNode);

          cleanNodes.push(cleanNode);
        } else {
          const targetArray = isStartFound ? cleanNodes : formattedNodes;
          targetArray.push(childNode);
        }
      }

      return nextNode;
    });

    const newNode = document.createElement(node.nodeName);
    formattedNodes.forEach((formattedNode) => {
      newNode.appendChild(formattedNode);
    });

    resultNodeArray.push(newNode, ...cleanNodes);
  }

  if (!containsStartContainer && containsEndContainer) {
    let isEndFound = false;
    const formattedNodes: Array<Node> = [];
    const cleanNodes: Array<Node> = [];

    iterateChildNodes(node, (childNode) => {
      const nextNode = childNode.nextSibling;

      if (isTextNode(childNode)) {
        if (childNode === endSelectionNode) {
          isEndFound = true;
          const fullText = childNode.textContent ?? '';
          const formattedTextNode = document.createTextNode(
            fullText.slice(endSelectionOffset)
          );
          const cleanTextNode = document.createTextNode(
            fullText.slice(0, endSelectionOffset)
          );

          newRange.setEnd(cleanTextNode, endSelectionOffset);

          formattedNodes.push(formattedTextNode);
          cleanNodes.push(cleanTextNode);
        } else {
          const targetArray = isEndFound ? formattedNodes : cleanNodes;
          targetArray.push(childNode);
        }
      } else {
        const nestedTextNode = childNode.firstChild;

        if (nestedTextNode === endSelectionNode) {
          isEndFound = true;
          const fullText = nestedTextNode.textContent ?? '';

          const formattedTextNode = document.createTextNode(
            fullText.slice(endSelectionOffset)
          );
          const formattedNode = document.createElement(childNode.nodeName);
          formattedNode.appendChild(formattedTextNode);

          formattedNodes.push(formattedNode);

          const cleanTextNode = document.createTextNode(
            fullText.slice(0, endSelectionOffset)
          );
          newRange.setEnd(cleanTextNode, endSelectionOffset);

          const cleanNode = document.createElement(childNode.nodeName);
          cleanNode.appendChild(cleanTextNode);

          cleanNodes.push(cleanNode);
        } else {
          const targetArray = isEndFound ? formattedNodes : cleanNodes;
          targetArray.push(childNode);
        }
      }

      return nextNode;
    });

    const newNode = document.createElement(node.nodeName);
    formattedNodes.forEach((formattedNode) => {
      newNode.appendChild(formattedNode);
    });

    resultNodeArray.push(...cleanNodes, newNode);
  }

  if (containsStartContainer && containsEndContainer) {
    let isStartFound = false;
    let isEndFound = false;

    const nodesBeforeSelection: Array<Node> = [];
    const nodesInSelection: Array<Node> = [];
    const nodesAfterSelection: Array<Node> = [];

    iterateChildNodes(node, (childNode) => {
      const nextNode = childNode.nextSibling;

      if (isTextNode(childNode)) {
        const fullText = childNode.textContent ?? '';

        /** node contains two selection ends */
        if (
          childNode === startSelectionNode &&
          childNode === endSelectionNode
        ) {
          isStartFound = true;
          isEndFound = true;

          const beforeSelectionTextNode = document.createTextNode(
            fullText.slice(0, startSelectionOffset)
          );
          nodesBeforeSelection.push(beforeSelectionTextNode);

          const inSelectionTextNode = document.createTextNode(
            fullText.slice(startSelectionOffset, endSelectionOffset)
          );
          nodesInSelection.push(inSelectionTextNode);

          const afterSelectionTextNode = document.createTextNode(
            fullText.slice(endSelectionOffset)
          );
          nodesAfterSelection.push(afterSelectionTextNode);

          /** node contains only selection start */
        } else if (childNode === startSelectionNode) {
          isStartFound = true;

          const beforeSelectionTextNode = document.createTextNode(
            fullText.slice(0, startSelectionOffset)
          );
          nodesBeforeSelection.push(beforeSelectionTextNode);

          const inSelectionTextNode = document.createTextNode(
            fullText.slice(startSelectionOffset)
          );
          nodesInSelection.push(inSelectionTextNode);

          /** node contains only selection end */
        } else if (childNode === endSelectionNode) {
          isEndFound = true;

          const inSelectionTextNode = document.createTextNode(
            fullText.slice(0, endSelectionOffset)
          );
          nodesInSelection.push(inSelectionTextNode);

          const afterSelectionTextNode = document.createTextNode(
            fullText.slice(endSelectionOffset)
          );
          nodesAfterSelection.push(afterSelectionTextNode);

          /** node doesn't contain any selection end */
        } else {
          const targetArray = !isStartFound
            ? nodesBeforeSelection
            : !isEndFound
            ? nodesInSelection
            : nodesAfterSelection;

          targetArray.push(childNode);
        }
      } else {
        /** suppose that node has only one child and it's child is text node */
        const nestedTextNode = childNode.firstChild;

        const fullText = childNode.textContent ?? '';

        /** node contains two selection ends */
        if (
          nestedTextNode === startSelectionNode &&
          nestedTextNode === endSelectionNode
        ) {
          isStartFound = true;
          isEndFound = true;

          const beforeSelectionNode = createNodeWithTextContent(
            childNode.nodeName,
            fullText.slice(0, startSelectionOffset)
          );
          nodesBeforeSelection.push(beforeSelectionNode);

          const inSelectionNode = createNodeWithTextContent(
            childNode.nodeName,
            fullText.slice(startSelectionOffset, endSelectionOffset)
          );
          nodesInSelection.push(inSelectionNode);

          const afterSelectionNode = createNodeWithTextContent(
            childNode.nodeName,
            fullText.slice(endSelectionOffset)
          );
          nodesAfterSelection.push(afterSelectionNode);

          /** node contains only selection start */
        } else if (nestedTextNode === startSelectionNode) {
          isStartFound = true;

          const beforeSelectionNode = createNodeWithTextContent(
            childNode.nodeName,
            fullText.slice(0, startSelectionOffset)
          );
          nodesBeforeSelection.push(beforeSelectionNode);

          const inSelectionNode = createNodeWithTextContent(
            childNode.nodeName,
            fullText.slice(startSelectionOffset)
          );
          nodesInSelection.push(inSelectionNode);

          /** node contains only selection end */
        } else if (nestedTextNode === endSelectionNode) {
          isEndFound = true;

          const inSelectionNode = createNodeWithTextContent(
            childNode.nodeName,
            fullText.slice(0, endSelectionOffset)
          );
          nodesInSelection.push(inSelectionNode);

          const afterSelectionNode = createNodeWithTextContent(
            childNode.nodeName,
            fullText.slice(endSelectionOffset)
          );
          nodesAfterSelection.push(afterSelectionNode);

          /** node doesn't contain any selection end */
        } else {
          const targetArray = !isStartFound
            ? nodesBeforeSelection
            : !isEndFound
            ? nodesInSelection
            : nodesAfterSelection;

          targetArray.push(childNode);
        }
      }

      return nextNode;
    });

    const beforeSelectionNode = document.createElement(node.nodeName);
    nodesBeforeSelection.forEach((childNode) => {
      beforeSelectionNode.appendChild(childNode);
    });

    const afterSelectionNode = document.createElement(node.nodeName);
    nodesAfterSelection.forEach((childNode) => {
      afterSelectionNode.appendChild(childNode);
    });

    resultNodeArray.push(
      beforeSelectionNode,
      ...nodesInSelection,
      afterSelectionNode
    );
  }

  return resultNodeArray;
}
