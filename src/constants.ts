export const NODE_NAMES = {
  H1: 'H1',
  H2: 'H2',
  PARAGRAPH: 'P',
  BOLD: 'STRONG',
  ITALIC: 'I',
} as const;

export const BLOCK_NODES = [NODE_NAMES.H1, NODE_NAMES.H2, NODE_NAMES.PARAGRAPH];
export const INLINE_NODES = [NODE_NAMES.BOLD, NODE_NAMES.ITALIC];

export const CLASS_MAP: Record<string, string> = {
  [NODE_NAMES.H1]: 'header1-text',
  [NODE_NAMES.H2]: 'header2-text',
  [NODE_NAMES.PARAGRAPH]: '',
  [NODE_NAMES.BOLD]: 'bold-text',
  [NODE_NAMES.ITALIC]: 'italic-text',
};
