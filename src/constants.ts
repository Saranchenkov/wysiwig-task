export const NODE_NAMES = {
  H1: 'H1',
  H2: 'H2',
  PARAGRAPH: 'P',
  BOLD: 'STRONG',
  ITALIC: 'I',
} as const;

export const BLOCK_NODES = [NODE_NAMES.H1, NODE_NAMES.H2, NODE_NAMES.PARAGRAPH];
export const INLINE_NODES = [NODE_NAMES.BOLD, NODE_NAMES.ITALIC];

export const styleMap: Record<string, string> = {
  [NODE_NAMES.H1]: 'font-weight: bold; font-size: 32px;',
  [NODE_NAMES.H2]: 'font-weight: bold; font-size: 24px;',
  [NODE_NAMES.PARAGRAPH]: '',
};
