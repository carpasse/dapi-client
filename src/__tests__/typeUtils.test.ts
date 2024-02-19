/* eslint-disable id-length, max-classes-per-file */
import {describe, it} from 'node:test';
import {AnyFunction, Constructor} from '../types/utils';
import {assertType} from '../types/assertType';

describe('utils', () => {
  describe('Constructor', () => {
    it('should match any constructor', () => {
      class TestClass {
        a: number;
        b: string;

        constructor(a: number, b: string) {
          this.a = a;
          this.b = b;
        }
      }

      assertType<Constructor<TestClass>>(TestClass);
      assertType<Constructor<{}>>(TestClass);
    });
  });

  describe('AnyFunction', () => {
    it('should match any function', () => {
      assertType<AnyFunction>(() => {});
      assertType<AnyFunction>(function () {});
      assertType<AnyFunction>(function named() {});
      assertType<AnyFunction>(async () => {});
      assertType<AnyFunction>(async function () {});
      assertType<AnyFunction>(async function named() {});
      assertType<AnyFunction>(function* () {});
      assertType<AnyFunction>(function* named() {});
    });
  });
});
