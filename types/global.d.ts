// Global type declarations for React Native

declare global {
  // React Native development flag
  var __DEV__: boolean;

  namespace NodeJS {
    interface Global {
      __DEV__: boolean;
    }
  }
}

// Declare react-test-renderer module for test files
declare module 'react-test-renderer' {
  import type { ReactElement } from 'react';

  export interface ReactTestRenderer {
    toJSON(): ReactTestRendererJSON | null;
    toTree(): ReactTestRendererTree | null;
    unmount(): void;
    update(element: ReactElement): void;
    getInstance(): unknown;
    root: ReactTestInstance;
  }

  export interface ReactTestRendererJSON {
    type: string;
    props: Record<string, unknown>;
    children: Array<ReactTestRendererJSON | string> | null;
  }

  export interface ReactTestRendererTree {
    nodeType: string;
    type: string | Function;
    props: Record<string, unknown>;
    instance: unknown;
    rendered: ReactTestRendererTree | ReactTestRendererTree[] | null;
  }

  export interface ReactTestInstance {
    instance: unknown;
    type: string | Function;
    props: Record<string, unknown>;
    parent: ReactTestInstance | null;
    children: Array<ReactTestInstance | string>;
    find(predicate: (node: ReactTestInstance) => boolean): ReactTestInstance;
    findAll(predicate: (node: ReactTestInstance) => boolean): ReactTestInstance[];
    findByType(type: Function | string): ReactTestInstance;
    findAllByType(type: Function | string): ReactTestInstance[];
    findByProps(props: Record<string, unknown>): ReactTestInstance;
    findAllByProps(props: Record<string, unknown>): ReactTestInstance[];
  }

  export function create(element: ReactElement): ReactTestRenderer;
  export function act(callback: () => void | Promise<void>): void | Promise<void>;
}

export {};
