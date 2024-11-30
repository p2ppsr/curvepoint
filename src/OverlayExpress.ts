import express from 'express'
import bodyParser from 'body-parser'
import { Engine, KnexStorage, LookupService, TopicManager } from '@bsv/overlay'
import { ARC, MerklePath, STEAK, TaggedBEEF, WhatsOnChain } from '@bsv/sdk'
import Knex from 'knex'
import { MongoClient, Db } from 'mongodb'
import makeUserInterface from './makeUserInterface.js'
import * as DiscoveryServices from '@bsv/overlay-discovery-services'

/**
 * Overlay Express class
 */
export default class OverlayExpress {
  app: express.Application
  logger: typeof console = console
  port: number = 3000
  engine: Engine | undefined = undefined
  knex: Knex.Knex | undefined = undefined
  migrateKey: string | undefined
  autoHandleMigrations: boolean = true
  enableGASPSync: boolean = true
  arcApiKey: string | undefined = undefined
  mongoDb: Db | undefined = undefined
  managers: Record<string, TopicManager> = {}
  services: Record<string, LookupService> = {}

  constructor(
    public name: string,
    public privateKey: string,
    public hostingURL: string
  ) {
    this.app = express()
    this.logger.log(`${name} constructed`)
  }

  // Configure Knex
  async configureKnex(config: Knex.Knex.Config) {
    this.knex = Knex(config)
    this.logger.log('Knex successfully configured.')
  }

  // Configure Mongo
  async configureMongo(connectionString: string) {
    const mongoClient = new MongoClient(connectionString)
    await mongoClient.connect()
    const db = mongoClient.db(`${this.name}_lookup_services`)
    this.mongoDb = db
    this.logger.log('MongoDB successfully configured and connected.')
  }

  configureTopicManager(name: string, manager: TopicManager) {
    this.managers[name] = manager
    this.logger.log(`Configured topic manager ${name}`)
  }

  configureLookupService(name: string, service: LookupService) {
    this.services[name] = service
    this.logger.log(`Configured lookup service ${name}`)
  }

  configureLookupServiceWithKnex(name: string, serviceFactory: (knex: Knex.Knex) => LookupService) {
    this.ensureKnex()
    this.services[name] = serviceFactory(this.knex as Knex.Knex)
    this.logger.log(`Configured lookup service ${name}`)
  }

  configureLookupServiceWithMongo(name: string, serviceFactory: (mongoDb: Db) => LookupService) {
    this.ensureMongo()
    this.services[name] = serviceFactory(this.mongoDb as Db)
    this.logger.log(`Configured lookup service ${name}`)
  }

  // Configure Engine
  async configureEngine(autoConfigureShipSlap = true) {
    this.ensureKnex()

    if (autoConfigureShipSlap) {
      this.configureTopicManager('tm_ship', new DiscoveryServices.SHIPTopicManager())
      this.configureTopicManager('tm_slap', new DiscoveryServices.SLAPTopicManager())
      this.configureLookupServiceWithMongo('ls_ship', (db) => new DiscoveryServices.SHIPLookupService(
        new DiscoveryServices.SHIPStorage(db)
      ))
      this.configureLookupServiceWithMongo('ls_slap', (db) => new DiscoveryServices.SLAPLookupService(
        new DiscoveryServices.SLAPStorage(db)
      ))
    }

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
      new WhatsOnChain(),
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

  private ensureKnex() {
    if (typeof this.knex === 'undefined') {
      throw new Error('You\'ll need to configure your SQL database with the .configureKnex() method first!')
    }
  }

  private ensureMongo() {
    if (typeof this.mongoDb === 'undefined') {
      throw new Error('You\'ll need to configure your MongoDB connection with the .configureMongo() method first!')
    }
  }

  private ensureEngine() {
    if (typeof this.engine === 'undefined') {
      throw new Error('You\'ll need to configure your Overlay Services engine with the .configureEngine() method first!')
    }
  }

  async start() {
    this.ensureEngine()
    this.ensureKnex()
    const engine = this.engine as Engine
    const knex = this.knex as Knex.Knex

    this.app.use(bodyParser.json({ limit: '1gb', type: 'application/json' }))
    this.app.use(bodyParser.raw({ limit: '1gb', type: 'application/octet-stream' }))

    // This allows the API to be used everywhere when CORS is enforced
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

    // TODO
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
          const result = await engine.getDocumentationForTopicManager(req.query.manager)
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
          const result = await engine.getDocumentationForLookupServiceProvider(req.query.lookupServices)
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
          const topics = JSON.parse(req.headers['x-topics'] as string)
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
      this.app.post('/arc-ingest', (req, res) => {
        (async () => {
          try {
            const merklePath = MerklePath.fromHex(req.body.merklePath)
            await engine.handleNewMerkleProof(req.body.txid, merklePath, req.body.blockHeight)
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
            console.log(req.body)
            const { graphID, txid, outputIndex, metadata } = req.body
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
      const result = await knex.migrate.latest()
      this.logger.log('Knex migrations run', result)
    }

    // 404, all other routes are not found.
    this.app.use((req, res) => {
      console.log('404', req.url)
      res.status(404).json({
        status: 'error',
        code: 'ERR_ROUTE_NOT_FOUND',
        description: 'Route not found.'
      })
    })

    this.app.listen(this.port, () => {
      this.logger.log(`${this.name} listening on local port ${this.port}`)
    })
  }
}