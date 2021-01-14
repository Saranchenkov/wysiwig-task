export const NODE_NAMES = {
  H1: 'H1',
  H2: 'H2',
  PARAGRAPH: 'P',
  BOLD: 'STRONG',
  ITALIC: 'I',
} as const;

export const BLOCK_NODES = [NODE_NAMES.H1, NODE_NAMES.H2, NODE_NAMES.PARAGRAPH];
export const INLINE_NODES = [NODE_NAMES.BOLD, NODE_NAMES.ITALIC];

export const STYLE_MAP: Record<string, string> = {
  [NODE_NAMES.H1]: 'font-size: 32px; font-weight: bold;',
  [NODE_NAMES.H2]: 'font-size: 24px; font-weight: bold;',
  [NODE_NAMES.PARAGRAPH]: 'font-size: 16px; font-weight: normal;',
  [NODE_NAMES.BOLD]: 'font-weight: bold;',
  [NODE_NAMES.ITALIC]: 'font-style: italic;',
};
