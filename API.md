# API

Links: [API](#api), [Classes](#classes), [Types](#types)

## Classes

### Class: OverlayExpress

OverlayExpress class provides an Express-based server for hosting Overlay Services.
It allows configuration of various components like databases, topic managers, and lookup services.
It encapsulates an Express application and provides methods to start the server.

```ts
export default class OverlayExpress {
    app: express.Application;
    port: number = 3000;
    logger: typeof console = console;
    knex: Knex.Knex | undefined = undefined;
    migrationsToRun: Array<Migration> = [];
    mongoDb: Db | undefined = undefined;
    network: "main" | "test" = "main";
    chainTracker: ChainTracker = new WhatsOnChain(this.network);
    engine: Engine | undefined = undefined;
    managers: Record<string, TopicManager> = {};
    services: Record<string, LookupService> = {};
    enableGASPSync: boolean = true;
    arcApiKey: string | undefined = undefined;
    verboseRequestLogging: boolean = false;
    webUIConfig: UIConfig = {};
    constructor(public name: string, public privateKey: string, public hostingURL: string) 
    configurePort(port: number) 
    configureWebUI(config: UIConfig) 
    configureLogger(logger: typeof console) 
    configureNetwork(network: "main" | "test") 
    configureChainTracker(chainTracker: ChainTracker = new WhatsOnChain(this.network)) 
    configureArcApiKey(apiKey: string) 
    configureEnableGASPSync(enable: boolean) 
    configureVerboseRequestLogging(enable: boolean) 
    async configureKnex(config: Knex.Knex.Config | string) 
    async configureMongo(connectionString: string) 
    configureTopicManager(name: string, manager: TopicManager) 
    configureLookupService(name: string, service: LookupService) 
    configureLookupServiceWithKnex(name: string, serviceFactory: (knex: Knex.Knex) => {
        service: LookupService;
        migrations: Array<Migration>;
    }) 
    configureLookupServiceWithMongo(name: string, serviceFactory: (mongoDb: Db) => LookupService) 
    async configureEngine(autoConfigureShipSlap = true) 
    async start() 
}
```

See also: [UIConfig](#type-uiconfig)

<details>

<summary>Class OverlayExpress Details</summary>

#### Constructor

Constructs an instance of OverlayExpress.

```ts
constructor(public name: string, public privateKey: string, public hostingURL: string) 
```

Argument Details

+ **name**
  + The name of the service
+ **privateKey**
  + Private key used for signing advertisements
+ **hostingURL**
  + The public URL where this service is hosted

#### Method configureArcApiKey

Configures the ARC API key.

```ts
configureArcApiKey(apiKey: string) 
```

Argument Details

+ **apiKey**
  + The ARC API key

#### Method configureChainTracker

Configures the ChainTracker to be used.

```ts
configureChainTracker(chainTracker: ChainTracker = new WhatsOnChain(this.network)) 
```

Argument Details

+ **chainTracker**
  + An instance of ChainTracker

#### Method configureEnableGASPSync

Enables or disables GASP synchronization.

```ts
configureEnableGASPSync(enable: boolean) 
```

Argument Details

+ **enable**
  + true to enable, false to disable

#### Method configureEngine

Configures the Overlay Engine.

```ts
async configureEngine(autoConfigureShipSlap = true) 
```

Argument Details

+ **autoConfigureShipSlap**
  + Whether to auto-configure SHIP and SLAP services (default: true)

#### Method configureKnex

Configures the Knex (SQL) database connection.

```ts
async configureKnex(config: Knex.Knex.Config | string) 
```

Argument Details

+ **config**
  + Knex configuration object, or MySQL connection string (e.g. mysql://overlayAdmin:overlay123@mysql:3306/overlay).

#### Method configureLogger

Configures the logger to be used by the server.

```ts
configureLogger(logger: typeof console) 
```

Argument Details

+ **logger**
  + A logger object (e.g., console)

#### Method configureLookupService

Configures a Lookup Service.

```ts
configureLookupService(name: string, service: LookupService) 
```

Argument Details

+ **name**
  + The name of the Lookup Service
+ **service**
  + An instance of LookupService

#### Method configureLookupServiceWithKnex

Configures a Lookup Service using Knex (SQL) database.

```ts
configureLookupServiceWithKnex(name: string, serviceFactory: (knex: Knex.Knex) => {
    service: LookupService;
    migrations: Array<Migration>;
}) 
```

Argument Details

+ **name**
  + The name of the Lookup Service
+ **serviceFactory**
  + A factory function that creates a LookupService instance using Knex

#### Method configureLookupServiceWithMongo

Configures a Lookup Service using MongoDB.

```ts
configureLookupServiceWithMongo(name: string, serviceFactory: (mongoDb: Db) => LookupService) 
```

Argument Details

+ **name**
  + The name of the Lookup Service
+ **serviceFactory**
  + A factory function that creates a LookupService instance using MongoDB

#### Method configureMongo

Configures the MongoDB database connection.

```ts
async configureMongo(connectionString: string) 
```

Argument Details

+ **connectionString**
  + MongoDB connection string

#### Method configureNetwork

Configures the BSV Blockchain network to be used ('main' or 'test').

```ts
configureNetwork(network: "main" | "test") 
```

Argument Details

+ **network**
  + The network ('main' or 'test')

#### Method configurePort

Configures the port on which the server will listen.

```ts
configurePort(port: number) 
```

Argument Details

+ **port**
  + The port number

#### Method configureTopicManager

Configures a Topic Manager.

```ts
configureTopicManager(name: string, manager: TopicManager) 
```

Argument Details

+ **name**
  + The name of the Topic Manager
+ **manager**
  + An instance of TopicManager

#### Method configureVerboseRequestLogging

Enables or disables verbose request logging.

```ts
configureVerboseRequestLogging(enable: boolean) 
```

Argument Details

+ **enable**
  + true to enable, false to disable

#### Method configureWebUI

Configures the web user interface

```ts
configureWebUI(config: UIConfig) 
```
See also: [UIConfig](#type-uiconfig)

Argument Details

+ **config**
  + Web UI configuration options

#### Method start

Starts the Express server.
Sets up routes and begins listening on the configured port.

```ts
async start() 
```

</details>

Links: [API](#api), [Classes](#classes), [Types](#types)

---
## Types

### Type: UIConfig

```ts
export type UIConfig = {
    faviconUrl?: string;
    backgroundColor?: string;
    primaryColor?: string;
    secondaryColor?: string;
    fontFamily?: string;
    headingFontFamily?: string;
    additionalStyles?: string;
    sectionBackgroundColor?: string;
    linkColor?: string;
    hoverColor?: string;
    borderColor?: string;
}
```

Links: [API](#api), [Classes](#classes), [Types](#types)

---
