import {DapiDefinition, DapiFns} from '@carpasse/dapi';
import {CloseFn, DapiClientMixin, IsHealthyFn} from './DapiClientMixin';
import {Constructor} from './types/utils';

/**
 * Creates a client DapiWrapper instance.
 * @public
 * @param definition - The API definition.
 * @param SuperClass - The super class.
 * @returns An instance of the client DAPI Wrapper facade.
 */
export const createDapiClient = <
  CLIENT,
  DEPENDENCIES extends {
    client: CLIENT;
  },
  API extends DapiFns<DEPENDENCIES>,
  T extends Constructor<{}>
>(
  definition: DapiDefinition<DEPENDENCIES, API> & {
    close?: CloseFn<DEPENDENCIES>;
    isHealthy?: IsHealthyFn<DEPENDENCIES>;
  },
  // eslint-disable-next-line @typescript-eslint/no-extraneous-class
  SuperClass: T = class {} as T
) => new (DapiClientMixin(definition, SuperClass))();
