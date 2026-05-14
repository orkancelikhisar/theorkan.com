export type FSNodeType = 'file' | 'dir' | 'device';

export interface FSNode {
  type: FSNodeType;
  content?: string;       // for files
  children?: Record<string, FSNode>;  // for dirs
  reader?: () => string;  // for devices
  meta?: {
    owner?: string;
    group?: string;
    perms?: string;
    mtime?: number;        // ms since epoch
    size?: number;
  };
}

export type FSSnapshot = FSNode;  // root node
