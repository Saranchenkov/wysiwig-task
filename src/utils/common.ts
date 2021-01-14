import { BLOCK_NODES, INLINE_NODES, NODE_NAMES, styleMap } from '../constants';

export function getCurrentSelection(): Selection | null {
  return document.getSelection();
}

export function isSupportedNode(node: Node): boolean {
  return Object.values<string>(NODE_NAMES).includes(node.nodeName);
}

export function isBlockNodeName(nodeName: string): boolean {
  return (BLOCK_NODES as Array<string>).includes(nodeName.toUpperCase());
}

export function isBlockNode(node: Node): boolean {
  return isBlockNodeName(node.nodeName);
}

export function isInlineNodeName(nodeName: string): boolean {
  return (INLINE_NODES as Array<string>).includes(nodeName.toUpperCase());
}

export function isInlineNode(node: Node): boolean {
  return isInlineNodeName(node.nodeName);
}

export function isTextNode(node: Node): boolean {
  return node.nodeType === Node.TEXT_NODE;
}

export function iterateChildNodes(
  node: Node,
  callback: (childNode: Node) => Node | null
): void {
  let currentChildNode: Node | null = node.firstChild;

  while (currentChildNode) {
    const nextSibling = callback(currentChildNode);
    currentChildNode = nextSibling ?? currentChildNode.nextSibling;
  }
}

export function replaceNode(
  oldNode: Node,
  newNode: Node,
  parentNode: Node
): void {
  iterateChildNodes(oldNode, (childNode) => {
    const nextNode = childNode.nextSibling;

    newNode.appendChild(childNode);

    return nextNode;
  });

  parentNode.replaceChild(newNode, oldNode);
}

export function replaceNodeName(
  oldNode: Node,
  newNodeName: string,
  parentNode: Node
): Node {
  if (oldNode.nodeName === newNodeName) return oldNode;

  const newNode = document.createElement(newNodeName);
  replaceNode(oldNode, newNode, parentNode);

  return newNode;
}

export function getEditableAreaElement(): HTMLElement {
  const element = document.getElementById('edit-area');

  if (!element) {
    throw new Error('Editor element is not found');
  }

  return element;
}

export function hasParentWithNodeName(
  currentNode: Node,
  parentNodeName: string
): boolean {
  const rootNode = getEditableAreaElement();

  if (!rootNode.contains(currentNode)) return false;

  let parent = currentNode.parentNode;

  while (parent && parent !== rootNode) {
    if (parent.nodeName.toUpperCase() === parentNodeName.toUpperCase()) {
      return true;
    }

    parent = parent.parentNode;
  }

  return false;
}

export function convertToNode(nodeOrText: string | Node): Node {
  return typeof nodeOrText === 'string'
    ? document.createTextNode(nodeOrText)
    : nodeOrText;
}

export function appendChild(
  parent: Node,
  nodeOrText: string | Node | null | undefined
): void {
  if (!nodeOrText) return;

  parent.appendChild(convertToNode(nodeOrText));
}

export function removeAllChildren(node: Node): void {
  let child = node.lastChild;
  while (child) {
    node.removeChild(child);
    child = node.lastChild;
  }
}

export function wrapTextNodeIntoSpecificNode(params: {
  textNode: Node;
  wrapperNode: Node;
  range: { start: number; end: number };
}) {
  const { textNode, wrapperNode, range } = params;

  const text = textNode.textContent ?? '';

  wrapperNode.textContent = text.slice(range.start, range.end);

  const newChildren: Array<Node | string> = [
    text.slice(0, range.start),
    wrapperNode,
    text.slice(range.end),
  ];

  const parent = textNode.parentNode;

  if (parent) {
    newChildren.forEach((child) => {
      const newChild = convertToNode(child);

      if (newChild.textContent) {
        parent.insertBefore(convertToNode(child), textNode);
      }
    });

    parent.removeChild(textNode);
  }
}

export function insertEmptyParagraphAndFocus(parentElement: HTMLElement) {
  const paragraph = document.createElement('p');
  paragraph.appendChild(document.createElement('br'));
  parentElement.appendChild(paragraph);

  const range = document.createRange();
  range.setStart(paragraph, 0);
  range.setEnd(paragraph, 0);

  const selection = getCurrentSelection();
  if (selection) {
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

export function updateButtonActiveStatus(range: Range): void {
  if (!range.collapsed) return;

  const elementWithCursor = range.startContainer;

  const rootNode = getEditableAreaElement();

  if (!rootNode.contains(elementWithCursor)) return;

  const buttonElementList = document.querySelectorAll('button[data-command]');

  buttonElementList.forEach((buttonElement) => {
    const nodeName = buttonElement.getAttribute('data-command') ?? '';

    const isActive = hasParentWithNodeName(
      elementWithCursor,
      nodeName.toUpperCase()
    );

    buttonElement.setAttribute('data-active', String(isActive));
  });
}

export function iterateSelectedNodes(
  callback: (selectedNode: Node) => void
): void {
  const selection = getCurrentSelection();

  if (!selection) return;

  const range = selection.getRangeAt(0);

  const ancestorNode = range.commonAncestorContainer;
  const rootNode = isTextNode(ancestorNode)
    ? ancestorNode.parentNode
    : ancestorNode;

  function handleChild(childNode: Node): Node | null {
    if (!selection || !selection.containsNode(childNode, true)) return null;

    callback(childNode);

    iterateChildNodes(childNode, handleChild);

    return null;
  }

  if (rootNode) {
    iterateChildNodes(rootNode, handleChild);
  }
}

export function applyStylesForNode(element: HTMLElement): void {
  const style = styleMap[element.nodeName];

  if (style) {
    element.setAttribute('style', style);
  } else {
    element.removeAttribute('style');
  }
}
