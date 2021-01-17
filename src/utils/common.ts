import { BLOCK_NODES, CLASS_MAP, INLINE_NODES, NODE_NAMES } from '../constants';

export function isElementNode(node: Node): boolean {
  return node.nodeType === Node.ELEMENT_NODE;
}

export function setStyleToElement(node: Node): void {
  if (!isElementNode(node)) return;

  const element = node as Element;

  const className = CLASS_MAP[element.nodeName];

  element.removeAttribute('style');

  if (className) {
    element.setAttribute('class', className);
  } else {
    element.removeAttribute('class');
  }
}

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

    if (nextSibling === currentChildNode) {
      console.warn('iterateChildNodes infinite loop possible');
    }

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

export function replaceNameOfStaticNode(
  staticNode: Node,
  newNodeName: string
): Node {
  const newNode = document.createElement(newNodeName);

  iterateChildNodes(staticNode, (childNode) => {
    const nextNode = childNode.nextSibling;

    newNode.appendChild(childNode);

    return nextNode;
  });

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
  setStyleToElement(paragraph);

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

export function cloneOneSideOfNodeTree(params: {
  ancestorNode: Element;
  dividerTextNode: Node | null;
  dividerTextOffset: number;
  cloneDirection: 'right' | 'left';
}): Node {
  const {
    ancestorNode,
    dividerTextNode,
    dividerTextOffset,
    cloneDirection,
  } = params;

  if (
    !dividerTextNode ||
    dividerTextNode === ancestorNode ||
    !ancestorNode.contains(dividerTextNode)
  )
    return ancestorNode;

  function getNextSiblingToClone(node: Node): Node | null {
    if (!node) return null;

    return cloneDirection === 'left' ? node.previousSibling : node.nextSibling;
  }

  function addChild(options: {
    parentNode: Node;
    currentNode: Node;
    newChildNode: Node;
  }): void {
    const { parentNode, currentNode, newChildNode } = options;

    if (cloneDirection === 'left') {
      parentNode.insertBefore(newChildNode, currentNode);
    } else {
      parentNode.appendChild(newChildNode);
    }
  }

  const fullText = dividerTextNode.textContent ?? '';

  const newTextContent =
    cloneDirection === 'left'
      ? fullText.slice(0, dividerTextOffset)
      : fullText.slice(dividerTextOffset);

  let currentNode: Node = dividerTextNode;
  let currentParentNode: Node | null = dividerTextNode.parentNode;
  let currentCloneNode: Node = document.createTextNode(newTextContent);

  let currentParentCloneNode: Node | null = currentParentNode
    ? currentParentNode.cloneNode(false)
    : null;

  if (currentParentCloneNode) {
    currentParentCloneNode.appendChild(currentCloneNode);
  }

  /** until we achieve the top of tree */
  while (
    currentParentNode &&
    currentParentCloneNode &&
    currentNode !== ancestorNode
  ) {
    let currentSiblingNode = getNextSiblingToClone(currentNode);

    while (currentSiblingNode) {
      const siblingClone = currentSiblingNode.cloneNode(true);

      if (currentParentCloneNode && currentCloneNode) {
        addChild({
          parentNode: currentParentCloneNode,
          currentNode: currentCloneNode,
          newChildNode: siblingClone,
        });
      }

      currentNode = currentSiblingNode;
      currentCloneNode = siblingClone;
      currentSiblingNode = getNextSiblingToClone(currentNode);
    }

    currentNode = currentParentNode;
    currentCloneNode = currentParentCloneNode;

    currentParentNode = currentNode.parentNode;

    currentParentCloneNode = currentParentNode
      ? currentParentNode.cloneNode(false)
      : null;

    if (currentParentCloneNode) {
      currentParentCloneNode.appendChild(currentCloneNode);
    }
  }

  return currentCloneNode ?? ancestorNode;
}

export function removeOneSideOfTree(params: {
  ancestorNode: Element;
  dividerTextNode: Node | null;
  dividerTextOffset: number;
  removeDirection: 'right' | 'left';
}): Node {
  const {
    ancestorNode,
    dividerTextNode,
    dividerTextOffset,
    removeDirection,
  } = params;
  if (
    !dividerTextNode ||
    dividerTextNode === ancestorNode ||
    !ancestorNode.contains(dividerTextNode)
  )
    return ancestorNode;

  function getNextSiblingToRemove(node: Node) {
    return removeDirection === 'right'
      ? node.nextSibling
      : node.previousSibling;
  }

  const fullText = dividerTextNode.textContent ?? '';

  dividerTextNode.textContent =
    removeDirection === 'left'
      ? fullText.slice(dividerTextOffset)
      : fullText.slice(0, dividerTextOffset);

  let currentNode = dividerTextNode;
  let currentParentNode = currentNode.parentNode;

  while (currentParentNode && currentNode !== ancestorNode) {
    let siblingToRemove = getNextSiblingToRemove(currentNode);

    while (siblingToRemove) {
      currentParentNode.removeChild(siblingToRemove);

      siblingToRemove = getNextSiblingToRemove(currentNode);
    }

    currentNode = currentParentNode;
    currentParentNode = currentNode.parentNode;
  }

  return currentNode;
}

export function splitNodeByTextNode(params: {
  ancestorNode: Node;
  dividerTextNode: Node;
  dividerTextOffset: number;
}): [Node, Node] {
  const { ancestorNode, dividerTextNode, dividerTextOffset } = params;

  const leftSideClone = cloneOneSideOfNodeTree({
    ancestorNode: ancestorNode as Element,
    dividerTextNode,
    dividerTextOffset,
    cloneDirection: 'left',
  });

  const rightSideClone = cloneOneSideOfNodeTree({
    ancestorNode: ancestorNode as Element,
    dividerTextNode,
    dividerTextOffset,
    cloneDirection: 'right',
  });

  return [leftSideClone, rightSideClone];
}

function applyComputedStyle(currentNode: Node, cloneNode: Node): Node {
  if (!isElementNode(currentNode) || !isElementNode(cloneNode))
    return cloneNode;

  /** some properties can be added in future */
  const STYLE_FIELDS = [
    'font-style',
    'font-variant',
    'font-weight',
    'font-stretch',
    'font-size',
    'line-height',
    'font-family',
    'color',
    'background-color',
    'text-decoration',
    'text-transform',
    'text-align',
  ];

  const computedStyle = window.getComputedStyle(currentNode as HTMLElement);

  STYLE_FIELDS.forEach((styleProp) => {
    const propValue = computedStyle.getPropertyValue(styleProp);
    (cloneNode as HTMLElement).style.setProperty(styleProp, propValue);
  });

  return cloneNode;
}

function cloneSelectedNode(
  selection: Selection,
  parentNode: Node,
  parentNodeClone: Node
): void {
  if (!selection.containsNode(parentNode, true)) return;

  const range = selection.getRangeAt(0);

  iterateChildNodes(parentNode, (childNode) => {
    if (!selection.containsNode(childNode, true)) return null;

    const childNodeClone = childNode.cloneNode(false);
    applyComputedStyle(childNode, childNodeClone);

    parentNodeClone.appendChild(childNodeClone);

    if (isTextNode(childNode)) {
      const isStartContainer = childNode === range.startContainer;
      const isEndContainer = childNode === range.endContainer;

      const currentTextContent = childNode.textContent ?? '';
      const startOffset = isStartContainer ? range.startOffset : 0;
      const endOffset = isEndContainer
        ? range.endOffset
        : currentTextContent.length;

      childNodeClone.textContent = currentTextContent.slice(
        startOffset,
        endOffset
      );
    }

    if (isElementNode(childNode)) {
      cloneSelectedNode(selection, childNode, childNodeClone);
    }

    return null;
  });
}

export function getSelectedContentAsString(selection: Selection) {
  const editableAreaElement = getEditableAreaElement();

  const nodeList: Array<Node> = [];

  editableAreaElement.childNodes.forEach((childNode) => {
    if (!selection.containsNode(childNode, true)) return;

    const childNodeClone = childNode.cloneNode(false);
    applyComputedStyle(childNode, childNodeClone);

    cloneSelectedNode(selection, childNode, childNodeClone);

    nodeList.push(childNodeClone);
  });

  let text = '';

  nodeList.forEach((childElement) => {
    text += (childElement as HTMLElement).outerHTML;
  });

  return text;
}
