import express from 'express'
import bodyParser from 'body-parser'
import { Engine, KnexStorage, LookupService, TopicManager } from '@bsv/overlay'
import { ARC, ChainTracker, MerklePath, STEAK, TaggedBEEF, WhatsOnChain } from '@bsv/sdk'
import Knex from 'knex'
import { MongoClient, Db } from 'mongodb'
import makeUserInterface from './makeUserInterface.js'
import * as DiscoveryServices from '@bsv/overlay-discovery-services'

/**
 * OverlayExpress class provides an Express-based server for hosting Overlay Services.
 * It allows configuration of various components like databases, topic managers, and lookup services.
 * It encapsulates an Express application and provides methods to start the server.
 */
export default class OverlayExpress {
  // Express application
  app: express.Application

  // Server port
  port: number = 3000

  // Logger (defaults to console)
  logger: typeof console = console

  // Knex (SQL) database
  knex: Knex.Knex | undefined = undefined

  // Migrate key for database migrations
  migrateKey: string | undefined = undefined

  // Whether to automatically handle migrations
  autoHandleMigrations: boolean = true

  // MongoDB database
  mongoDb: Db | undefined = undefined

  // Network ('main' or 'test')
  network: 'main' | 'test' = 'main'

  // Chain tracker
  chainTracker: ChainTracker = new WhatsOnChain(this.network)

  // The Overlay Engine
  engine: Engine | undefined = undefined

  // Configured Topic Managers
  managers: Record<string, TopicManager> = {}

  // Configured Lookup Services
  services: Record<string, LookupService> = {}

  // Enable GASP Sync
  enableGASPSync: boolean = true

  // ARC API Key
  arcApiKey: string | undefined = undefined

  /**
   * Constructs an instance of OverlayExpress.
   * @param name - The name of the service
   * @param privateKey - Private key used for signing advertisements
   * @param hostingURL - The public URL where this service is hosted
   */
  constructor(
    public name: string,
    public privateKey: string,
    public hostingURL: string
  ) {
    this.app = express()
    this.logger.log(`${name} constructed`)
  }

  /**
   * Configures the port on which the server will listen.
   * @param port - The port number
   */
  configurePort(port: number) {
    this.port = port
    this.logger.log(`Server port set to ${port}`)
  }

  /**
   * Configures the logger to be used by the server.
   * @param logger - A logger object (e.g., console)
   */
  configureLogger(logger: typeof console) {
    this.logger = logger
    this.logger.log('Logger has been configured.')
  }

  /**
   * Configures the BSV Blockchain network to be used ('main' or 'test').
   * @param network - The network ('main' or 'test')
   */
  configureNetwork(network: 'main' | 'test') {
    this.network = network
    this.chainTracker = new WhatsOnChain(this.network)
    this.logger.log(`Network set to ${network}`)
  }

  /**
   * Configures the ChainTracker to be used.
   * @param chainTracker - An instance of ChainTracker
   */
  configureChainTracker(chainTracker: ChainTracker = new WhatsOnChain(this.network)) {
    this.chainTracker = chainTracker
    this.logger.log('ChainTracker has been configured.')
  }

  /**
   * Configures whether to automatically handle database migrations.
   * @param autoHandle - true to auto-handle migrations, false to require manual triggering
   */
  configureAutoHandleMigrations(autoHandle: boolean) {
    this.autoHandleMigrations = autoHandle
    this.logger.log(`Auto handle migrations ${autoHandle ? 'enabled' : 'disabled'}.`)
  }

  /**
   * Configures the migrate key for manual database migrations.
   * @param migrateKey - The migration key
   */
  configureMigrateKey(migrateKey: string) {
    this.migrateKey = migrateKey
    this.logger.log('Migrate key has been configured.')
  }

  /**
   * Configures the ARC API key.
   * @param apiKey - The ARC API key
   */
  configureArcApiKey(apiKey: string) {
    this.arcApiKey = apiKey
    this.logger.log('ARC API key has been configured.')
  }

  /**
   * Enables or disables GASP synchronization.
   * @param enable - true to enable, false to disable
   */
  configureEnableGASPSync(enable: boolean) {
    this.enableGASPSync = enable
    this.logger.log(`GASP synchronization ${enable ? 'enabled' : 'disabled'}.`)
  }

  /**
   * Configures the Knex (SQL) database connection.
   * @param config - Knex configuration object
   */
  async configureKnex(config: Knex.Knex.Config) {
    this.knex = Knex(config)
    this.logger.log('Knex successfully configured.')
  }

  /**
   * Configures the MongoDB database connection.
   * @param connectionString - MongoDB connection string
   */
  async configureMongo(connectionString: string) {
    const mongoClient = new MongoClient(connectionString)
    await mongoClient.connect()
    const db = mongoClient.db(`${this.name}_lookup_services`)
    this.mongoDb = db
    this.logger.log('MongoDB successfully configured and connected.')
  }

  /**
   * Configures a Topic Manager.
   * @param name - The name of the Topic Manager
   * @param manager - An instance of TopicManager
   */
  configureTopicManager(name: string, manager: TopicManager) {
    this.managers[name] = manager
    this.logger.log(`Configured topic manager ${name}`)
  }

  /**
   * Configures a Lookup Service.
   * @param name - The name of the Lookup Service
   * @param service - An instance of LookupService
   */
  configureLookupService(name: string, service: LookupService) {
    this.services[name] = service
    this.logger.log(`Configured lookup service ${name}`)
  }

  /**
   * Configures a Lookup Service using Knex (SQL) database.
   * @param name - The name of the Lookup Service
   * @param serviceFactory - A factory function that creates a LookupService instance using Knex
   */
  configureLookupServiceWithKnex(name: string, serviceFactory: (knex: Knex.Knex) => LookupService) {
    this.ensureKnex()
    this.services[name] = serviceFactory(this.knex as Knex.Knex)
    this.logger.log(`Configured lookup service ${name} with Knex`)
  }

  /**
   * Configures a Lookup Service using MongoDB.
   * @param name - The name of the Lookup Service
   * @param serviceFactory - A factory function that creates a LookupService instance using MongoDB
   */
  configureLookupServiceWithMongo(name: string, serviceFactory: (mongoDb: Db) => LookupService) {
    this.ensureMongo()
    this.services[name] = serviceFactory(this.mongoDb as Db)
    this.logger.log(`Configured lookup service ${name} with MongoDB`)
  }

  /**
   * Configures the Overlay Engine.
   * @param autoConfigureShipSlap - Whether to auto-configure SHIP and SLAP services (default: true)
   */
  async configureEngine(autoConfigureShipSlap = true) {
    this.ensureKnex()

    if (autoConfigureShipSlap) {
      // Auto-configure SHIP and SLAP services
      this.configureTopicManager('tm_ship', new DiscoveryServices.SHIPTopicManager())
      this.configureTopicManager('tm_slap', new DiscoveryServices.SLAPTopicManager())
      this.configureLookupServiceWithMongo('ls_ship', (db) => new DiscoveryServices.SHIPLookupService(
        new DiscoveryServices.SHIPStorage(db)
      ))
      this.configureLookupServiceWithMongo('ls_slap', (db) => new DiscoveryServices.SLAPLookupService(
        new DiscoveryServices.SLAPStorage(db)
      ))
    }

    // Sync configuration
    let syncConfig: Record<string, false> = {}
    if (!this.enableGASPSync) {
      for (const manager of Object.keys(this.managers)) {
        syncConfig[manager] = false
      }
    }

    const storage = new KnexStorage(this.knex as Knex.Knex)
    this.engine = new Engine(
      this.managers,
      this.services,
      storage,
      this.chainTracker,
      this.hostingURL,
      undefined,
      undefined,
      this.arcApiKey ? new ARC('https://arc.taal.com', {
        apiKey: this.arcApiKey
      }) : undefined,
      new DiscoveryServices.LegacyNinjaAdvertiser(this.privateKey, 'https://dojo.babbage.systems', this.hostingURL),
      syncConfig
    )
    this.logger.log('Engine has been configured.')
  }

  /**
   * Ensures that Knex is configured.
   * @throws Error if Knex is not configured
   */
  private ensureKnex() {
    if (typeof this.knex === 'undefined') {
      throw new Error('You\'ll need to configure your SQL database with the .configureKnex() method first!')
    }
  }

  /**
   * Ensures that MongoDB is configured.
   * @throws Error if MongoDB is not configured
   */
  private ensureMongo() {
    if (typeof this.mongoDb === 'undefined') {
      throw new Error('You\'ll need to configure your MongoDB connection with the .configureMongo() method first!')
    }
  }

  /**
   * Ensures that the Overlay Engine is configured.
   * @throws Error if the Engine is not configured
   */
  private ensureEngine() {
    if (typeof this.engine === 'undefined') {
      throw new Error('You\'ll need to configure your Overlay Services engine with the .configureEngine() method first!')
    }
  }

  /**
   * Starts the Express server.
   * Sets up routes and begins listening on the configured port.
   */
  async start() {
    this.ensureEngine()
    this.ensureKnex()
    const engine = this.engine as Engine
    const knex = this.knex as Knex.Knex

    this.app.use(bodyParser.json({ limit: '1gb', type: 'application/json' }))
    this.app.use(bodyParser.raw({ limit: '1gb', type: 'application/octet-stream' }))

    // Enable CORS
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*')
      res.header('Access-Control-Allow-Headers', '*')
      res.header('Access-Control-Allow-Methods', '*')
      res.header('Access-Control-Expose-Headers', '*')
      res.header('Access-Control-Allow-Private-Network', 'true')
      if (req.method === 'OPTIONS') {
        res.sendStatus(200)
      } else {
        next()
      }
    })

    // Serve a static documentation site or user interface
    this.app.get('/', (req, res) => {
      res.set('content-type', 'text/html')
      res.send(makeUserInterface())
    })

    // List hosted topic managers and lookup services
    this.app.get('/listTopicManagers', (_, res) => {
      (async () => {
        try {
          const result = await engine.listTopicManagers()
          return res.status(200).json(result)
        } catch (error) {
          return res.status(400).json({
            status: 'error',
            message: error instanceof Error ? error.message : 'An unknown error occurred'
          })
        }
      })().catch(() => {
        // This catch is for any unforeseen errors in the async IIFE itself
        res.status(500).json({
          status: 'error',
          message: 'Unexpected error'
        })
      })
    })

    this.app.get('/listLookupServiceProviders', (_, res) => {
      (async () => {
        try {
          const result = await engine.listLookupServiceProviders()
          return res.status(200).json(result)
        } catch (error) {
          return res.status(400).json({
            status: 'error',
            message: error instanceof Error ? error.message : 'An unknown error occurred'
          })
        }
      })().catch(() => {
        res.status(500).json({
          status: 'error',
          message: 'Unexpected error'
        })
      })
    })

    // Host documentation for the services
    this.app.get('/getDocumentationForTopicManager', (req, res) => {
      (async () => {
        try {
          const manager = req.query.manager as string
          const result = await engine.getDocumentationForTopicManager(manager)
          res.setHeader('Content-Type', 'text/markdown')
          return res.status(200).send(result)
        } catch (error) {
          return res.status(400).json({
            status: 'error',
            message: error instanceof Error ? error.message : 'An unknown error occurred'
          })
        }
      })().catch(() => {
        res.status(500).json({
          status: 'error',
          message: 'Unexpected error'
        })
      })
    })

    this.app.get('/getDocumentationForLookupServiceProvider', (req, res) => {
      (async () => {
        try {
          const lookupService = req.query.lookupService as string
          const result = await engine.getDocumentationForLookupServiceProvider(lookupService)
          return res.status(200).json(result)
        } catch (error) {
          return res.status(400).json({
            status: 'error',
            message: error instanceof Error ? error.message : 'An unknown error occurred'
          })
        }
      })().catch(() => {
        res.status(500).json({
          status: 'error',
          message: 'Unexpected error'
        })
      })
    })

    // Submit transactions and facilitate lookup requests
    this.app.post('/submit', (req, res) => {
      (async () => {
        try {
          // Parse out the topics and construct the tagged BEEF
          const topicsHeader = req.headers['x-topics']
          if (!topicsHeader) {
            throw new Error('Missing x-topics header')
          }
          const topics = JSON.parse(topicsHeader as string)
          const taggedBEEF: TaggedBEEF = {
            beef: Array.from(req.body as number[]),
            topics
          }

          // Using a callback function, we can just return once our steak is ready
          // instead of having to wait for all the broadcasts to occur.
          await engine.submit(taggedBEEF, (steak: STEAK) => {
            return res.status(200).json(steak)
          })
        } catch (error) {
          console.error(error)
          return res.status(400).json({
            status: 'error',
            message: error instanceof Error ? error.message : 'An unknown error occurred'
          })
        }
      })().catch(() => {
        res.status(500).json({
          status: 'error',
          message: 'Unexpected error'
        })
      })
    })

    this.app.post('/lookup', (req, res) => {
      (async () => {
        try {
          const result = await engine.lookup(req.body)
          return res.status(200).json(result)
        } catch (error) {
          console.error(error)
          return res.status(400).json({
            status: 'error',
            message: error instanceof Error ? error.message : 'An unknown error occurred'
          })
        }
      })().catch(() => {
        res.status(500).json({
          status: 'error',
          message: 'Unexpected error'
        })
      })
    })

    if (this.arcApiKey) {
      // Route for ARC ingest
      this.app.post('/arc-ingest', (req, res) => {
        (async () => {
          try {
            const { txid, merklePath: merklePathHex, blockHeight } = req.body
            const merklePath = MerklePath.fromHex(merklePathHex)
            await engine.handleNewMerkleProof(txid, merklePath, blockHeight)
            return res.status(200).json({ status: 'success', message: 'transaction status updated' })
          } catch (error) {
            console.error(error)
            return res.status(400).json({
              status: 'error',
              message: error instanceof Error ? error.message : 'An unknown error occurred'
            })
          }
        })().catch(() => {
          res.status(500).json({
            status: 'error',
            message: 'Unexpected error'
          })
        })
      })
    } else {
      this.logger.warn('Disabling Arc because no Arc API key was provided.')
    }

    if (this.enableGASPSync) {
      // Routes for GASP synchronization
      this.app.post('/requestSyncResponse', (req, res) => {
        (async () => {
          try {
            const topic = req.headers['x-bsv-topic'] as string
            const response = await engine.provideForeignSyncResponse(req.body, topic)
            return res.status(200).json(response)
          } catch (error) {
            console.error(error)
            return res.status(400).json({
              status: 'error',
              message: error instanceof Error ? error.message : 'An unknown error occurred'
            })
          }
        })().catch(() => {
          res.status(500).json({
            status: 'error',
            message: 'Unexpected error'
          })
        })
      })
      this.app.post('/requestForeignGASPNode', (req, res) => {
        (async () => {
          try {
            const { graphID, txid, outputIndex } = req.body
            const response = await engine.provideForeignGASPNode(graphID, txid, outputIndex)
            return res.status(200).json(response)
          } catch (error) {
            console.error(error)
            return res.status(400).json({
              status: 'error',
              message: error instanceof Error ? error.message : 'An unknown error occurred'
            })
          }
        })().catch(() => {
          res.status(500).json({
            status: 'error',
            message: 'Unexpected error'
          })
        })
      })
    } else {
      this.logger.warn('GASP sync is disabled.')
    }

    if (!this.autoHandleMigrations) {
      // Route to manually trigger database migrations
      this.app.post('/migrate', (req, res) => {
        (async () => {
          if (
            typeof this.migrateKey === 'string' &&
            this.migrateKey.length > 10 &&
            req.body.migratekey === this.migrateKey
          ) {
            const result = await knex.migrate.latest()
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
          console.error(error)
          res.status(500).json({
            status: 'error',
            message: 'Unexpected error'
          })
        })
      })
    } else {
      // Automatically handle migrations
      const result = await knex.migrate.latest()
      this.logger.log('Knex migrations run', result)
    }

    // 404 handler for all other routes
    this.app.use((req, res) => {
      this.logger.log('404', req.url)
      res.status(404).json({
        status: 'error',
        code: 'ERR_ROUTE_NOT_FOUND',
        description: 'Route not found.'
      })
    })

    // Start listening on the configured port
    this.app.listen(this.port, () => {
      this.logger.log(`${this.name} listening on local port ${this.port}`)
    })
  }
}