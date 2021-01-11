import { BLOCK_NODES, INLINE_NODES, NODE_NAMES } from './constants';

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

export function replaceNode(
  oldNode: Node,
  newNode: Node,
  parentNode: Node
): void {
  oldNode.childNodes.forEach((nestedChildNode) => {
    newNode.appendChild(nestedChildNode);
  });

  parentNode.replaceChild(newNode, oldNode);
}

export function replaceNodeName(
  oldNode: Node,
  newNodeName: string,
  parentNode: Node
) {
  const newNode = document.createElement(newNodeName);
  replaceNode(oldNode, newNode, parentNode);
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
    if (parent.nodeName === parentNodeName) {
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

  const rootNode = textNode.parentNode;

  const text = textNode.textContent ?? '';
  wrapperNode.textContent = text.slice(range.start, range.end);

  const newChildren: Array<Node | string> = [
    text.slice(0, range.start),
    wrapperNode,
    text.slice(range.end),
  ];

  let previousSiblingNode = textNode.previousSibling;

  while (previousSiblingNode) {
    newChildren.unshift(previousSiblingNode);
    previousSiblingNode = previousSiblingNode?.previousSibling ?? null;
  }

  let nextSiblingNode = textNode.nextSibling;

  while (nextSiblingNode) {
    newChildren.push(nextSiblingNode);
    nextSiblingNode = nextSiblingNode?.nextSibling ?? null;
  }

  if (rootNode) {
    removeAllChildren(rootNode);

    newChildren.forEach((child) => appendChild(rootNode, child));
  }
}

export function insertEmptyParagraphAndFocus(parentElement: HTMLElement) {
  const paragraph = document.createElement('p');
  paragraph.appendChild(document.createElement('br'));
  parentElement.appendChild(paragraph);

  const range = new Range();
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
