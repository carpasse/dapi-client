/* eslint-disable no-invalid-this */
import {DapiDefinition, DapiMixin, type DapiFn, type DapiWrapper} from '@carpasse/dapi';
import {AnyFunction, Constructor} from './types/utils';

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
  const {close: _close, isHealthy: _isHealthy, dependencies} = definition;

  if (_close && typeof _close !== 'function') {
    throw new TypeError('close must be a function', {cause: {close: _close}});
  }

  if (_isHealthy && typeof _isHealthy !== 'function') {
    throw new TypeError('isHealthy must be a function', {cause: {_isHealthy}});
  }

  // @ts-expect-error - Make sure that the dependencies object does not have a dynamically added properties.
  if (dependencies.close || dependencies.isHealthy || dependencies.status) {
    throw new TypeError(
      'Dependencies cannot have a `close` or `isHealthy` or `status` property.\n' +
        'Please remove it from the dependencies.',
      {
        cause: {dependencies}
      }
    );
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

  /**
   * Closes the client.
   * @param delay The delay before closing the client.
   */
  const close = async function (this: Self, deps: DapiClientDependencies, {delay}: {delay?: number} = {}) {
    if (deps.status !== ClientStatus.OPEN) {
      return;
    }

    if (typeof _close === 'function') {
      this.updateDependencies({status: ClientStatus.CLOSING} as Partial<DapiClientDependencies>);
      await _close.call(this, deps, {delay});
    }

    this.updateDependencies({status: ClientStatus.CLOSED} as Partial<DapiClientDependencies>);
  };

  const status = (deps: DapiClientDependencies) => deps.status;

  /**
   * Returns whether the client is healthy.
   * @returns true if the client is healthy and false otherwise.
   */
  const isHealthy = async function (this: Self, deps: DapiClientDependencies) {
    if (deps.status !== ClientStatus.OPEN) {
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
      dependencies: {
        ...definition.dependencies,
        status: ClientStatus.OPEN
      },
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
