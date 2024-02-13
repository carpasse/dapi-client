import {describe, it} from 'node:test';
import assert from 'node:assert/strict';
import {test} from '../index';

describe('index', () => {
  it('should export test', () => {
    assert.equal(test, 'test');
  });
});
