/* eslint-disable no-invalid-this */
import {DapiDefinition, DapiMixin, type DapiFn, type DapiWrapper} from '@carpasse/dapi';
import {AnyFunction, Constructor} from './types/utils.js';

/**
 * The status of the client.
 * @public
 * @enum
 * @readonly
 * @property OPEN The client is open.
 * @property CLOSED The client is closed.
 * @property CLOSING The client is closing.
 */
export enum ClientStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  CLOSING = 'closing'
}

export type CloseFn<DEPENDENCIES> = DapiFn<
  (dependencies: DEPENDENCIES, opts?: {delay?: number}) => Promise<void> | void,
  DEPENDENCIES
>;

export type IsHealthyFn<DEPENDENCIES> = DapiFn<
  (dependencies: DEPENDENCIES) => Promise<boolean> | boolean,
  DEPENDENCIES
>;

const validateDefinition = <
  CLIENT,
  DEPENDENCIES extends {
    client: CLIENT;
  },
  DAPI extends {
    [key: string]: DapiFn<AnyFunction, DEPENDENCIES>;
  }
>(
  definition: DapiDefinition<DEPENDENCIES, DAPI> & {
    close?: CloseFn<DEPENDENCIES>;
    isHealthy?: IsHealthyFn<DEPENDENCIES>;
  }
) => {
  const {close: _close, isHealthy: _isHealthy, dependencies, fns} = definition;

  if (_close && typeof _close !== 'function') {
    throw new TypeError('close must be a function', {cause: {close: _close}});
  }

  if (_isHealthy && typeof _isHealthy !== 'function') {
    throw new TypeError('isHealthy must be a function', {cause: {_isHealthy}});
  }

  if (!dependencies) {
    throw new TypeError('Definition must have dependencies', {cause: {dependencies}});
  }

  // @ts-expect-error - Make sure that the dependencies object does not have a dynamically added properties.
  if (dependencies.close || dependencies.isHealthy) {
    throw new TypeError(
      'Dependencies cannot have a `close` or `isHealthy` properties.\n' +
        'Please remove them from the dependencies object.',
      {
        cause: {dependencies}
      }
    );
  }

  if (!dependencies.client) {
    throw new TypeError('Dependencies must have a client', {cause: {dependencies}});
  }

  if (typeof fns !== 'object' || fns === null) {
    throw new TypeError('Definition must have a dictionary (`fns`) of Dapi functions', {cause: {fns}});
  }

  if (Object.values(fns).some((fn) => typeof fn !== 'function')) {
    throw new TypeError("Definition's fns dictionary must only contain values of type fn", {cause: {fns}});
  }
};

export function DapiClientMixin<
  CLIENT,
  DEPENDENCIES extends {
    client: CLIENT;
  },
  DAPI extends {
    [key: string]: DapiFn<AnyFunction, DEPENDENCIES>;
  },
  T extends Constructor<{}>
>(
  definition: DapiDefinition<DEPENDENCIES, DAPI> & {
    close?: CloseFn<DEPENDENCIES>;
    isHealthy?: IsHealthyFn<DEPENDENCIES>;
  },
  SuperClass: T
) {
  validateDefinition(definition);

  type DapiClientDependencies = DEPENDENCIES & {
    status: ClientStatus;
  };
  type DapiClientFns = {
    close: CloseFn<DapiClientDependencies>;
    isHealthy: IsHealthyFn<DapiClientDependencies>;
  };
  type Self = InstanceType<DapiWrapper<DapiClientDependencies, DAPI & DapiClientFns, T>>;
  const {close: _close, isHealthy: _isHealthy} = definition;
  let _status = ClientStatus.OPEN;

  /**
   * Closes the client.
   * @param delay The delay before closing the client.
   */
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  const close = function (this: Self, deps: DapiClientDependencies, {delay}: {delay?: number} = {}) {
    if (_status !== ClientStatus.OPEN) {
      return;
    }

    if (typeof _close === 'function') {
      _status = ClientStatus.CLOSING;
      const response = _close.call(this, deps, {delay});

      if (response instanceof Promise) {
        return response.then(() => {
          _status = ClientStatus.CLOSED;
        });
      }
    }

    _status = ClientStatus.CLOSED;

    return undefined;
  };

  const status = () => _status;

  /**
   * Returns whether the client is healthy.
   * @returns true if the client is healthy and false otherwise.
   */
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  const isHealthy = function (this: Self, deps: DapiClientDependencies) {
    if (_status !== ClientStatus.OPEN) {
      return false;
    }

    if (typeof _isHealthy === 'function') {
      return _isHealthy.call(this, deps);
    }

    return true;
  };

  return DapiMixin(
    {
      ...definition,
      dependencies: definition.dependencies,
      fns: {
        ...definition.fns,
        close,
        isHealthy,
        status
      }
    },
    SuperClass
  );
}

/**
 * Mixin for creating a Client API facade.
 *
 * @template CLIENT The type of the client.
 * @template DEPENDENCIES The api dependencies, must include a property `client` of type CLIENT.
 * @template API Object of pure functions. All functions must accepts as their first argument a DEPENDENCIES obj.
 * @template T The constructor type of the class being enhanced.
 * @param definition The API definition.
 * @param SuperClass The superclass.
 *
 * @returns {ClientWrapper<DEPENDENCIES, API, T>}.
 */
export type DapiClientWrapper<
  CLIENT,
  DEPENDENCIES extends {
    client: CLIENT;
  },
  DAPI extends {
    [key: string]: DapiFn<AnyFunction, DEPENDENCIES>;
  },
  T extends Constructor<{}>
> = ReturnType<typeof DapiClientMixin<CLIENT, DEPENDENCIES, DAPI, T>>;
