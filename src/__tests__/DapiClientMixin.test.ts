import {describe, it, mock, beforeEach, Mock} from 'node:test';
import assert from 'node:assert/strict';
import {DapiDefinition} from '@carpasse/dapi';
import {DapiClientMixin, ClientStatus, CloseFn} from '../DapiClientMixin';

class BaseTestClass {
  test = 'test';
}

describe('DapiClientMixin', () => {
  type Client = {method1: () => string};
  type Opts = {
    foo?: string;
  };
  type Deps = {
    client: Client;
    opts: Opts;
  };
  type DapiFnsDict = {
    command1: Mock<(deps: Deps, a?: string) => string>;
    command2: Mock<
      (deps: {client: Client; opts: Opts}, a1?: string, a2?: string) => [typeof deps, typeof a1, typeof a2]
    >;
    command3: Mock<(deps: Deps) => Promise<string>>;
  };

  let client: Client;
  let fns: DapiFnsDict;
  let type: string;
  let opts: Opts;
  let dependencies: Deps;
  let definition: DapiDefinition<Deps, DapiFnsDict>;

  beforeEach(() => {
    client = {method1: mock.fn(() => 'mockClient.method1')};
    opts = {foo: 'bar'};
    fns = {
      command1: mock.fn(({client: {method1}}) => method1()),
      command2: mock.fn((deps, a1, a2) => [deps, a1, a2]),
      command3: mock.fn(async ({client: {method1}}) => Promise.resolve(method1()))
    };
    type = 'test';
    dependencies = {client, opts};
    definition = {dependencies, fns, type};
  });

  it('should throw if the passed definition does not have Dapi functions dictionary', () => {
    assert.throws(
      () => {
        // @ts-expect-error - no fns dictionary
        DapiClientMixin({dependencies, type}, BaseTestClass);
      },
      {
        cause: {
          fns: undefined
        },
        message: 'Definition must have a dictionary (`fns`) of Dapi functions',
        name: 'TypeError'
      }
    );

    assert.throws(
      () => {
        // @ts-expect-error - no fns dictionary
        DapiClientMixin({dependencies, fns: null, type}, BaseTestClass);
      },
      {
        cause: {
          fns: null
        },
        message: 'Definition must have a dictionary (`fns`) of Dapi functions',
        name: 'TypeError'
      }
    );

    assert.throws(
      () => {
        // @ts-expect-error - no fns dictionary
        DapiClientMixin({dependencies, fns: {foo: null}, type}, BaseTestClass);
      },
      {
        cause: {
          fns: {foo: null}
        },
        message: "Definition's fns dictionary must only contain values of type fn",
        name: 'TypeError'
      }
    );
  });

  it('should throw if the passed definition does not have a type', () => {
    assert.throws(
      () => {
        // @ts-expect-error - no type
        DapiClientMixin({dependencies, fns}, BaseTestClass);
      },
      {
        cause: {
          type: undefined
        },
        message: 'Definition must have a type',
        name: 'TypeError'
      }
    );
  });

  it('should throw if the passed definition does not have dependencies', () => {
    assert.throws(
      () => {
        // @ts-expect-error - no dependencies
        DapiClientMixin({fns, type}, BaseTestClass);
      },
      {
        cause: {
          dependencies: undefined
        },
        message: 'Definition must have dependencies',
        name: 'TypeError'
      }
    );
  });

  describe('constructor', () => {
    it('should throw if the passed definition does not have a client', () => {
      assert.throws(
        () => {
          // @ts-expect-error - no client
          new (DapiClientMixin({dependencies: {}, fns, type}, BaseTestClass))();
        },
        {
          cause: {
            dependencies: {}
          },
          message: 'Dependencies must have a client',
          name: 'TypeError'
        }
      );
    });

    it('should change the state to closing and then to close once it finishes closing', async () => {
      const closeFn: CloseFn<Deps> = mock.fn(async (_deps, options = {delay: 0}) => {
        await new Promise((resolve) => setTimeout(resolve, options.delay));
      });
      const closeFnMock = (closeFn as Mock<CloseFn<Deps>>).mock;

      const instance = new (DapiClientMixin(
        {
          ...definition,
          close: closeFn
        },
        BaseTestClass
      ))();
      const status = instance.status();

      assert.equal(status, ClientStatus.OPEN);

      const closePromise = instance.close({delay: 1});

      assert.equal(instance.status(), ClientStatus.CLOSING);
      assert.equal(closeFnMock.callCount(), 1);
      assert.deepEqual(closeFnMock.calls[0].arguments, [instance.getDependencies(), {delay: 1}]);
      assert.equal(closeFnMock.calls[0].this, instance);

      await closePromise;
      assert.equal(instance.status(), ClientStatus.CLOSED);
    });

    it('should throw if the close command throws', async () => {
      const closeFn: CloseFn<Deps> = mock.fn(async () => {
        throw new Error('Failed to close');
      });

      const instance = new (DapiClientMixin(
        {
          ...definition,
          close: closeFn
        },
        BaseTestClass
      ))();

      assert.rejects(async () => instance.close(), {
        message: 'Failed to close',
        name: 'Error'
      });
    });

    it('isHealthy should return false if the status is closed', async () => {
      const closeFn: CloseFn<Deps> = mock.fn(async (_deps, options = {delay: 0}) => {
        await new Promise((resolve) => setTimeout(resolve, options.delay));
      });

      const {close, isHealthy, status} = new (DapiClientMixin(
        {
          ...definition,
          close: closeFn
        },
        BaseTestClass
      ))();

      assert.equal(status(), ClientStatus.OPEN);
      assert.equal(await isHealthy(), true);

      const closePromise = close({delay: 1});

      assert.equal(status && status(), ClientStatus.CLOSING);
      assert.equal(isHealthy && (await isHealthy()), false);

      await closePromise;
      assert.equal(status && status(), ClientStatus.CLOSED);
      assert.equal(isHealthy && (await isHealthy()), false);
    });

    it('should be possible to pass a custom isHealthy fn', async () => {
      const isHealthyFn = mock.fn(async () => true);
      const isHealthyFnMock = (isHealthyFn as Mock<typeof isHealthy>).mock;
      const instance = new (DapiClientMixin(
        {
          ...definition,
          isHealthy: isHealthyFn
        },
        BaseTestClass
      ))();
      const {isHealthy} = instance;

      assert.equal(isHealthy && (await isHealthy()), true);
      assert.equal(isHealthyFnMock.callCount(), 1);
      assert.equal(isHealthyFnMock.calls[0].this, instance);
      assert.deepEqual(isHealthyFnMock.calls[0].arguments, [instance.getDependencies()]);
    });

    it('DAPI fns should be bound to the instance and the first arg to the instance dependencies', async () => {
      const instance = new (DapiClientMixin(definition, BaseTestClass))();
      const {command1, command2, command3} = instance;

      assert.equal(command1(), 'mockClient.method1');
      assert.deepEqual(command2('a1', 'a2'), [instance.getDependencies(), 'a1', 'a2']);
      assert.equal(await command3(), 'mockClient.method1');

      const command1Mock = fns.command1.mock;
      const command2Mock = fns.command2.mock;
      const command3Mock = fns.command3.mock;

      assert.equal(command1Mock.callCount(), 1);
      assert.equal(command1Mock.calls[0].this, instance);
      assert.deepEqual(command1Mock.calls[0].arguments, [instance.getDependencies()]);
      assert.equal(command2Mock.callCount(), 1);
      assert.equal(command2Mock.calls[0].this, instance);
      assert.deepEqual(command2Mock.calls[0].arguments, [instance.getDependencies(), 'a1', 'a2']);
      assert.equal(command3Mock.callCount(), 1);
      assert.equal(command3Mock.calls[0].this, instance);
      assert.deepEqual(command3Mock.calls[0].arguments, [instance.getDependencies()]);
    });

    it('should be possible to decorate api fn', async () => {
      const instance = new (DapiClientMixin(definition, BaseTestClass))();
      const {command1, command3} = instance;

      instance.addDecorator('command1', (method, deps) => `${method(deps)} decorated`);
      instance.addDecorator('command3', async (method, deps) => `${await method(deps)} decorated`);
      assert.equal(command1(), 'mockClient.method1 decorated');
      assert.equal(await command3(), 'mockClient.method1 decorated');
    });

    it('should be possible to hook to a command', async () => {
      const instance = new (DapiClientMixin(definition, BaseTestClass))();
      const {command1} = instance;
      const preHook = mock.fn();
      const postHook = mock.fn();

      instance.addPreHook('command1', preHook);
      instance.addPostHook('command1', postHook);

      assert.equal(command1(), 'mockClient.method1');

      assert.equal(preHook.mock.callCount(), 1);
      assert.equal(preHook.mock.calls[0].this, instance);
      assert.equal(postHook.mock.callCount(), 1);
      assert.equal(postHook.mock.calls[0].this, instance);
    });

    it('should throw if you try to set falsy dependencies', () => {
      const instance = new (DapiClientMixin(definition, BaseTestClass))();

      assert.throws(
        () => {
          instance.setDependencies(undefined as unknown as Deps & {status: ClientStatus});
        },
        {
          cause: {
            dependencies: undefined
          },
          message: 'Dependencies must be defined',
          name: 'TypeError'
        }
      );
    });

    it('should be possible to set the dependencies', () => {
      const instance = new (DapiClientMixin(definition, BaseTestClass))();
      const newClient = {method1: () => 'newClient.method1'};
      const newDependencies: Deps = {client: newClient, opts: {foo: 'baz'}};

      instance.setDependencies(newDependencies);

      assert.deepEqual(instance.getDependencies(), newDependencies);
    });

    it('should be possible to set the client only', () => {
      const instance = new (DapiClientMixin(definition, BaseTestClass))();
      const newClient = {method1: () => 'newClient.method1'};
      const oldDependencies = instance.getDependencies();

      instance.updateDependencies({client: newClient});

      assert.deepEqual(instance.getDependencies(), {...oldDependencies, client: newClient});
    });

    it('should be possible to get the client with the getter and the dependencies getter', () => {
      const instance = new (DapiClientMixin(definition, BaseTestClass))();

      assert.equal(definition.dependencies.client, instance.getDependencies().client);
    });
  });
});
