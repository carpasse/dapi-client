# dapi-client

Helper library to create a wrapper of a [client-server model](https://en.wikipedia.org/wiki/Client%E2%80%93server_model) client singleton using the [dapi](https://github.com/carpasse/dapi?tab=readme-ov-file#dapi) library.

## Installation

```bash
npm install dapi-client
```

## Description

![client-server model](/docs/assets/server-client_dark-mode.svg#gh-dark-mode-only)
![client-server model](/docs/assets/server-client_light-mode.svg#gh-light-mode-only)

A typical nodejs application depends on a lot of services, like databases, caches, message brokers, etc. This library helps to create a a facade api on top of the singletons of the services, so the application can use the same instance of the service in the whole application. Making the application more easy to maintain and test.

## Usage

```typescript
import redis, {RedisOptions} from 'redis';
import { createClient } from '@carpasse/dapi-client';
import type { Logger } from 'pino';

export const createRedisClient = (options: RedisOptions, logger: Logger) => createClient({
  dependencies: {
    client: redis.createClient(options),
    logger,
  },
  fns: {
    close: ({client, logger}) => client.quit(),
  },
}
```

// TODO: add integration tests with a real redis server in both commonjs and esm.
