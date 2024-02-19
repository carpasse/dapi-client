/* eslint-disable @typescript-eslint/no-explicit-any */
// From https://github.com/microsoft/TypeScript/pull/13743
/**
 * Matches any constructor
 */
export type Constructor<T> = new (...args: any[]) => T;

/**
 * Matches any function
 */
export type AnyFunction = (...args: any[]) => any;
