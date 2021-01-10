const NODE_NAMES = {
  H1: 'H1',
  H2: 'H2',
  PARAGRAPH: 'P',
  BOLD: 'STRONG',
  ITALIC: 'I',
} as const;

const BLOCK_NODES = [NODE_NAMES.H1, NODE_NAMES.H2, NODE_NAMES.PARAGRAPH];
const INLINE_NODES = [NODE_NAMES.BOLD, NODE_NAMES.ITALIC];

const editAreaElement = document.getElementById('edit-area');

let selection = document.getSelection();

function hasParentWithNodeName(
  currentNode: Node,
  parentNodeName: string
): boolean {
  if (!editAreaElement) return false;
  if (!editAreaElement.contains(currentNode)) return false;

  let parent = currentNode.parentNode;

  while (parent && parent !== editAreaElement) {
    if (parent.nodeName === parentNodeName) {
      return true;
    }

    parent = parent.parentNode;
  }

  return false;
}

function updateButtonActiveStatus(range: Range): void {
  if (!range.collapsed) return;

  const buttonElementList = document.querySelectorAll('button[data-command]');

  const elementWithCursor = range.startContainer;

  buttonElementList.forEach((buttonElement) => {
    const nodeName =
      buttonElement.getAttribute('data-command')?.toUpperCase() ?? '';

    const isActive = hasParentWithNodeName(elementWithCursor, nodeName);

    buttonElement.setAttribute('data-active', String(isActive));
  });
}

document.addEventListener('selectionchange', () => {
  selection = document.getSelection();

  if (selection) {
    const range = selection.getRangeAt(0);
    console.log('range', range);

    updateButtonActiveStatus(range);
  }
});

function convertToNode(nodeOrText: string | Node): Node {
  return typeof nodeOrText === 'string'
    ? document.createTextNode(nodeOrText)
    : nodeOrText;
}

function appendChild(
  parent: Node,
  nodeOrText: string | Node | null | undefined
): void {
  if (!nodeOrText) return;

  parent.appendChild(convertToNode(nodeOrText));
}

function removeAllChildren(node: Node): void {
  let child = node.lastChild;
  while (child) {
    node.removeChild(child);
    child = node.lastChild;
  }
}

function insertEmptyParagraph(element: HTMLElement) {
  const paragraph = document.createElement('p');
  paragraph.appendChild(document.createElement('br'));
  element.appendChild(paragraph);

  const range = new Range();
  range.setStart(paragraph, 0);
  range.setEnd(paragraph, 0);

  if (selection) {
    selection.addRange(range);
  }
}

if (editAreaElement) {
  editAreaElement.addEventListener('focus', () => {
    if (editAreaElement.children.length === 0) {
      insertEmptyParagraph(editAreaElement);
    }
  });

  const mutationObserver = new MutationObserver(() => {
    if (editAreaElement.children.length === 0) {
      insertEmptyParagraph(editAreaElement);
    }
  });

  mutationObserver.observe(editAreaElement, { childList: true });
}

function wrapTextNodeIntoSpecificNode(params: {
  textNode: Node;
  wrapperNodeName: string;
  range: { start: number; end: number };
}): HTMLElement {
  const { textNode, wrapperNodeName, range } = params;

  const rootNode = textNode.parentNode;

  const text = textNode.textContent ?? '';
  const wrapperNode = document.createElement(wrapperNodeName);
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

  return wrapperNode;
}

function walkTreeToUpdateInlineNode(nodeName: string): void {
  if (!selection) return;
  const range = selection.getRangeAt(0);

  if (range.collapsed) return;

  const containerNode = range.commonAncestorContainer;

  const rootNode =
    containerNode.nodeType === Node.TEXT_NODE
      ? containerNode.parentNode
      : containerNode;

  if (!rootNode) return;

  let isStartContainerFound = false;
  let isEndContainerFound = false;

  function checkChild(childNode: Node): void {
    if (!rootNode) return;
    if (isEndContainerFound) return;

    if (!isStartContainerFound && !childNode.contains(range.startContainer))
      return;

    if (childNode === range.startContainer) {
      isStartContainerFound = true;
    }

    if (childNode === range.endContainer) {
      isEndContainerFound = true;
    }

    if (childNode.nodeType === Node.TEXT_NODE) {
      const textNode = childNode;

      const startOffset =
        childNode === range.startContainer ? range.startOffset : 0;
      const endOffset =
        childNode === range.endContainer
          ? range.endOffset
          : (textNode.textContent ?? '').length;

      if (!hasParentWithNodeName(textNode, nodeName)) {
        const wrapperNode = wrapTextNodeIntoSpecificNode({
          textNode,
          range: {
            start: startOffset,
            end: endOffset,
          },
          wrapperNodeName: nodeName,
        });

        // TODO fix ranges
        // if (childNode === range.startContainer) {
        //   range.setStart(wrapperNode, 0);
        // }
        //
        // if (childNode === range.endContainer) {
        //   range.setEnd(wrapperNode, (wrapperNode.textContent ?? '').length);
        // }
      }
    } else if (childNode.childNodes.length > 0) {
      childNode.childNodes.forEach(checkChild);
    }
  }

  rootNode.childNodes.forEach(checkChild);
}

function getButtonByNodeName(nodeName: string): Element | null {
  return document.querySelector(`[data-command="${nodeName.toLowerCase()}"]`);
}

const boldButton = getButtonByNodeName(NODE_NAMES.BOLD);

if (boldButton) {
  boldButton.addEventListener('click', () => {
    walkTreeToUpdateInlineNode(NODE_NAMES.BOLD);
  });
}

const italicButton = getButtonByNodeName(NODE_NAMES.ITALIC);

if (italicButton) {
  italicButton.addEventListener('click', () => {
    walkTreeToUpdateInlineNode(NODE_NAMES.ITALIC);
  });
}
