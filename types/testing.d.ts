/**
 * Type declarations for testing utilities
 * Provides proper typing for Jest mocks and test renderer
 */

// Declare react-test-renderer module
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

// Augment Jest types for better mock support
declare global {
  namespace jest {
    interface Mock<T = unknown, Y extends unknown[] = unknown[]> {
      mockResolvedValue(value: Awaited<T>): this;
      mockResolvedValueOnce(value: Awaited<T>): this;
      mockRejectedValue(value: unknown): this;
      mockRejectedValueOnce(value: unknown): this;
      mockImplementation(fn: (...args: Y) => T): this;
      mockImplementationOnce(fn: (...args: Y) => T): this;
      mockReturnValue(value: T): this;
      mockReturnValueOnce(value: T): this;
      mockClear(): this;
      mockReset(): this;
      mockRestore(): void;
    }
  }
}

export {};
