import express from 'express';
import bodyParser from 'body-parser';
import { Engine, KnexStorage, LookupService, TopicManager } from '@bsv/overlay';
import { ARC, ChainTracker, MerklePath, STEAK, TaggedBEEF, WhatsOnChain } from '@bsv/sdk';
import Knex from 'knex';
import { MongoClient, Db } from 'mongodb';
import * as DiscoveryServices from '@bsv/overlay-discovery-services';

/**
 * OverlayExpress Class
 *
 * A configurable builder-based system for setting up and managing an Express server
 * integrated with BSV Overlay services.
 */
export default class OverlayExpress {
  app: express.Application;
  port: number = 3000;
  logger: typeof console = console;

  knex?: Knex.Knex;
  mongoDb?: Db;
  engine?: Engine;

  private topicManagers: Record<string, TopicManager> = {};
  private lookupServices: Record<string, LookupService> = {};
  private network: 'main' | 'test' = 'main';
  private chainTracker: ChainTracker;
  private arcApiKey?: string;
  private enableGASPSync: boolean = true;
  private migrateKey?: string;
  private autoHandleMigrations: boolean = true;

  constructor(
    private readonly name: string,
    private readonly privateKey: string,
    private readonly hostingURL: string
  ) {
    this.app = express();
    this.chainTracker = new WhatsOnChain(this.network);
    this.logger.log(`${name} OverlayExpress instance created.`);
  }

  /**
   * Configures the SQL database using Knex.
   *
   * @param config - Knex configuration object
   */
  async configureKnex(config: Knex.Knex.Config) {
    this.knex = Knex(config);
    this.logger.log('Knex configured.');
  }

  /**
   * Configures the MongoDB connection.
   *
   * @param connectionString - MongoDB connection string
   */
  async configureMongo(connectionString: string) {
    const mongoClient = new MongoClient(connectionString);
    await mongoClient.connect();
    this.mongoDb = mongoClient.db(`${this.name}_lookup_services`);
    this.logger.log('MongoDB connected.');
  }

  /**
   * Adds a topic manager to the system.
   *
   * @param name - Identifier for the topic manager
   * @param manager - Instance of the topic manager
   */
  configureTopicManager(name: string, manager: TopicManager) {
    this.topicManagers[name] = manager;
    this.logger.log(`Topic Manager "${name}" configured.`);
  }

  /**
   * Adds a lookup service to the system.
   *
   * @param name - Identifier for the lookup service
   * @param service - Instance of the lookup service
   */
  configureLookupService(name: string, service: LookupService) {
    this.lookupServices[name] = service;
    this.logger.log(`Lookup Service "${name}" configured.`);
  }

  /**
   * Configures a lookup service with a Knex-based storage provider.
   *
   * @param name - Identifier for the lookup service
   * @param factory - Factory function to create the lookup service
   */
  configureLookupServiceWithKnex(name: string, factory: (knex: Knex.Knex) => LookupService) {
    if (!this.knex) throw new Error('Knex must be configured first.');
    this.lookupServices[name] = factory(this.knex);
    this.logger.log(`Lookup Service "${name}" configured with Knex.`);
  }

  /**
   * Configures a lookup service with a MongoDB-based storage provider.
   *
   * @param name - Identifier for the lookup service
   * @param factory - Factory function to create the lookup service
   */
  configureLookupServiceWithMongo(name: string, factory: (mongoDb: Db) => LookupService) {
    if (!this.mongoDb) throw new Error('MongoDB must be configured first.');
    this.lookupServices[name] = factory(this.mongoDb);
    this.logger.log(`Lookup Service "${name}" configured with MongoDB.`);
  }

  /**
   * Configures the Overlay Engine with its topic managers and lookup services.
   *
   * @param autoConfigureDefaults - Whether to automatically configure default services
   */
  async configureEngine(network: 'main' | 'test' = 'main', autoConfigureDefaults = true) {
    if (!this.knex) throw new Error('Knex must be configured first.');

    if (autoConfigureDefaults) {
      this.configureTopicManager('tm_ship', new DiscoveryServices.SHIPTopicManager());
      this.configureTopicManager('tm_slap', new DiscoveryServices.SLAPTopicManager());
      this.configureLookupServiceWithMongo('ls_ship', (db) => new DiscoveryServices.SHIPLookupService(
        new DiscoveryServices.SHIPStorage(db)
      ));
      this.configureLookupServiceWithMongo('ls_slap', (db) => new DiscoveryServices.SLAPLookupService(
        new DiscoveryServices.SLAPStorage(db)
      ));
    }

    const storage = new KnexStorage(this.knex);
    const syncConfig: Record<string, false> = {};

    if (!this.enableGASPSync) {
      Object.keys(this.topicManagers).forEach((manager) => {
        syncConfig[manager] = false;
      });
    }

    this.engine = new Engine(
      this.topicManagers,
      this.lookupServices,
      storage,
      this.chainTracker,
      this.hostingURL,
      undefined,
      undefined,
      this.arcApiKey ? new ARC('https://arc.taal.com', { apiKey: this.arcApiKey }) : undefined,
      new DiscoveryServices.LegacyNinjaAdvertiser(this.privateKey, 'https://dojo.babbage.systems', this.hostingURL),
      syncConfig
    );

    this.logger.log('Overlay Engine configured.');
  }

  /**
   * Starts the Express server and initializes the Overlay Engine.
   */
  async start() {
    if (!this.engine) throw new Error('Engine must be configured first.');
    if (!this.knex) throw new Error('Knex must be configured first.');

    this.app.use(bodyParser.json({ limit: '1gb' }));
    this.app.use(bodyParser.raw({ limit: '1gb', type: 'application/octet-stream' }));

    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', '*');
      res.header('Access-Control-Allow-Methods', '*');
      if (req.method === 'OPTIONS') res.sendStatus(200);
      else next();
    });

    this.app.get('/listTopicManagers', async (_, res) => {
      try {
        const result = await this.engine?.listTopicManagers();
        res.status(200).json(result);
      } catch (error) {
        this.handleError(res, error);
      }
    });

    this.app.get('/listLookupServiceProviders', async (_, res) => {
      try {
        const result = await this.engine?.listLookupServiceProviders();
        res.status(200).json(result);
      } catch (error) {
        this.handleError(res, error);
      }
    });

    this.app.post('/submit', async (req, res) => {
      try {
        const topics = JSON.parse(req.headers['x-topics'] as string);
        const taggedBEEF: TaggedBEEF = { beef: Array.from(req.body as number[]), topics };
        await this.engine?.submit(taggedBEEF, (steak: STEAK) => res.status(200).json(steak));
      } catch (error) {
        this.handleError(res, error);
      }
    });

    if (this.autoHandleMigrations) {
      const result = await this.knex.migrate.latest();
      this.logger.log('Migrations complete:', result);
    } else {
      this.app.post('/migrate', (req, res) => {
        (async () => {
          if (
            typeof this.migrateKey === 'string' &&
            this.migrateKey.length > 10 &&
            req.body.migratekey === this.migrateKey
          ) {
            const result = await this.knex!.migrate.latest()
            res.status(200).json({
              status: 'success',
              result
            })
          } else {
            res.status(401).json({
              status: 'error',
              code: 'ERR_UNAUTHORIZED',
              description: 'Access with this key was denied.'
            })
          }
        })().catch((error) => {
          this.handleError(res, error)
        })
      })
    }

    this.app.listen(this.port, () => {
      this.logger.log(`${this.name} server started on port ${this.port}`);
    });
  }

  /**
   * Handles errors and sends appropriate responses.
   *
   * @param res - Express response object
   * @param error - Error to handle
   */
  private handleError(res: express.Response, error: unknown) {
    this.logger.error(error);
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
}
