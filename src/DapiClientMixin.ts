import {DapiDefinition, DapiMixin, type DapiFn, type DapiWrapper} from '@carpasse/dapi';
import {AnyFunction, Constructor, ParamsExtract} from './types/utils';

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
export type CloseFnFacade<DEPENDENCIES> = (
  ...args: ParamsExtract<CloseFn<DEPENDENCIES>, [DEPENDENCIES]>
) => ReturnType<CloseFn<DEPENDENCIES>>;
export type IsHealthyFn<DEPENDENCIES> = DapiFn<
  (dependencies: DEPENDENCIES) => Promise<boolean> | boolean,
  DEPENDENCIES
>;
export type IsHealthyFnFacade<DEPENDENCIES> = (
  ...args: ParamsExtract<IsHealthyFn<DEPENDENCIES>, [DEPENDENCIES]>
) => ReturnType<IsHealthyFn<DEPENDENCIES>>;

function ClientMixin<
  CLIENT,
  DEPENDENCIES extends {
    client: CLIENT;
  },
  T extends DapiWrapper<DEPENDENCIES, {}, Constructor<{}>>
>(
  definition: {
    close?: CloseFn<DEPENDENCIES>;
    isHealthy?: IsHealthyFn<DEPENDENCIES>;
  },
  SuperClass: T
) {
  const {close, isHealthy} = definition;

  /**
   * @class DapiClientWrapper<DEPENDENCIES, API, T>
   * @classdesc Enhanced class with specific logic to deal with service [clients](https://en.wikipedia.org/wiki/Client_(computing)) of the [client-server model](https://en.wikipedia.org/wiki/Client%E2%80%93server_model) or similar.
   * @template CLIENT The type of the client.
   * @template DEPENDENCIES The api dependencies, must include a property `client` of type CLIENT.
   * @template DAPI dictionary of pure functions. All functions must accepts as their first argument a DEPENDENCIES obj.
   * @template T The constructor type of the class being enhanced.
   * @extends {DapiWrapper<DEPENDENCIES, DAPI, T>}
   */
  class DapiClientWrapper extends SuperClass {
    private _status: ClientStatus;
    private _close: CloseFn<DEPENDENCIES> | undefined;
    private _isHealthy: IsHealthyFn<DEPENDENCIES> | undefined;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(...args: any[]) {
      super(...args);

      const dependencies = this.getDependencies();

      if (!dependencies.client) {
        throw new TypeError('Dependencies must have a client', {
          cause: {dependencies}
        });
      }

      this._status = ClientStatus.OPEN;
      this._close = close;
      this._isHealthy = isHealthy;

      this.close = this.close.bind(this);
      this.isHealthy = this.isHealthy.bind(this);
      this.status = this.status.bind(this);

      this.setDependencies({
        ...dependencies,
        close: this.close,
        isHealthy: this.isHealthy,
        status: this.status
      });
    }

    /**
     * Returns the status of the client.
     * @returns The status of the client.
     */
    status() {
      return this._status;
    }

    /**
     * Client getter.
     * @returns The inner client.
     */
    getClient() {
      return this.getDependencies()?.client;
    }

    /**
     * Client setter.
     * @param newClient The new client.
     * @throws If the client is falsy.
     */
    setClient(newClient: CLIENT) {
      if (!newClient) {
        throw new TypeError('Client cannot be falsy', {cause: {client: newClient}});
      }

      const dependencies = this.getDependencies();

      if (dependencies?.client === newClient) {
        return;
      }

      dependencies.client = newClient;
    }

    /**
     * Dependencies setter.
     * @param newDeps The new dependencies.
     * @throws If the dependencies are falsy.
     * @throws If the dependencies do not have a client.
     */
    setDependencies(newDeps: DEPENDENCIES) {
      if (!newDeps) {
        throw new TypeError(`Dependencies must be defined`, {cause: {dependencies: newDeps}});
      }

      if (!newDeps.client) {
        throw new TypeError(`Dependencies must have a client`, {cause: {dependencies: newDeps}});
      }

      const dependencies = this.getDependencies();

      if (dependencies === newDeps) {
        return;
      }

      super.setDependencies(newDeps);
    }

    /**
     * Closes the client.
     * @param delay The delay before closing the client.
     */
    async close({delay}: {delay?: number} = {}) {
      if (this._status !== ClientStatus.OPEN) {
        return;
      }

      if (this._close) {
        this._status = ClientStatus.CLOSING;

        await this._close(this.getDependencies(), {delay});
      }

      this._status = ClientStatus.CLOSED;
    }

    /**
     * Returns whether the client is healthy.
     * @returns true if the client is healthy and false otherwise.
     */
    async isHealthy() {
      if (this._status !== ClientStatus.OPEN) {
        return false;
      }

      if (this._isHealthy) {
        return this._isHealthy(this.getDependencies());
      }

      return true;
    }
  }

  return DapiClientWrapper;
}

/**
 * The dependencies of the client.
 * @public
 * @template CLIENT The type of the client.
 */
export interface ClientDependencies<CLIENT> {
  client: CLIENT;
  close?: CloseFnFacade<ClientDependencies<CLIENT>>;
  isHealthy?: IsHealthyFnFacade<ClientDependencies<CLIENT>>;
  status?: () => ClientStatus;
}

export function DapiClientMixin<
  CLIENT,
  DEPENDENCIES extends ClientDependencies<CLIENT>,
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
  // @ts-expect-error - TS doesn't understand dynamic mixins
  return ClientMixin(definition, DapiMixin(definition, SuperClass));
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
  DEPENDENCIES extends ClientDependencies<CLIENT>,
  DAPI extends {
    [key: string]: DapiFn<AnyFunction, DEPENDENCIES>;
  },
  T extends Constructor<{}>
> = ReturnType<typeof DapiClientMixin<CLIENT, DEPENDENCIES, DAPI, T>>;
