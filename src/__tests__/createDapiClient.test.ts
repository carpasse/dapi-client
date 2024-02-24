import {describe, it, mock, beforeEach, Mock} from 'node:test';
import assert from 'node:assert/strict';
import EventEmitter from 'node:events';
import {DapiDefinition} from '@carpasse/dapi';
import {ClientStatus} from '../DapiClientMixin';
import {createDapiClient} from '../createDapiClient';

describe('createDapiClient', () => {
  type Client = {method1: () => string};
  type Opts = {
    foo?: string;
  };
  type Deps = {
    client: Client;
    opts: Opts;
  };
  type command1Mock = Mock<(deps: Deps, a1?: string, a2?: string) => [typeof deps, typeof a1, typeof a2]>;
  type DapiFnsDict = {
    command1: command1Mock;
  };

  let client: Client;
  let command1: command1Mock;
  let fns: DapiFnsDict;
  let type: string;
  let opts: Opts;
  let dependencies: Deps;
  let definition: DapiDefinition<Deps, DapiFnsDict>;

  beforeEach(() => {
    client = {method1: mock.fn(() => 'mockClient.method1')};
    opts = {foo: 'bar'};
    command1 = mock.fn((deps, a1, a2) => [deps, a1, a2]);
    fns = {
      command1
    };
    type = 'test';
    dependencies = {client, opts};
    definition = {dependencies, fns, type};
  });

  it('should create an dapi', () => {
    const instance = createDapiClient(definition);

    assert.equal(typeof instance.command1, 'function');
    assert.equal(typeof instance.close, 'function');
    assert.equal(typeof instance.isHealthy, 'function');
    assert.equal(instance.status(), ClientStatus.OPEN);
  });

  it('should call the command', () => {
    const instance = createDapiClient(definition);

    instance.command1('a1', 'a2');

    assert.equal(command1.mock.calls.length, 1);
    assert.deepEqual(command1.mock.calls[0].arguments, [instance.getDependencies(), 'a1', 'a2']);
  });

  it('should be possible to pass a super class', () => {
    const instance = createDapiClient(definition, EventEmitter);

    assert(instance instanceof EventEmitter);
  });

  it('should be possible to decorate a command', () => {
    const instance = createDapiClient(definition, EventEmitter);
    const spy = mock.fn();

    instance.on('command1', spy);
    instance.addDecorator('command1', function (this: typeof instance, next, ...args) {
      // eslint-disable-next-line no-invalid-this
      this.emit('command1', ...args);

      return next(...args);
    });

    instance.command1('a1', 'a2');

    assert.equal(spy.mock.calls.length, 1);
    assert.deepEqual(spy.mock.calls[0].arguments, [instance.getDependencies(), 'a1', 'a2']);
    assert.equal(command1.mock.calls.length, 1);
    assert.deepEqual(command1.mock.calls[0].arguments, [instance.getDependencies(), 'a1', 'a2']);
  });
});
