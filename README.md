# Overlay Express

BSV BLOCKCHAIN | Overlay Express

An opinionated but configurable Overlay Services deployment system:
- Uses express for HTTP(S)
- Implements a configurable web UI
- Uses common MySQL and Mongo databases
- Supports SHIP, SLAP, GASP out of the box (or not)
- Uses ngrok automatically (or not)
- Supports Arc callbacks natively (or not)

## Example Usage

```typescript
import OverlayExpress from '@bsv/overlay-express'

;(async () => {
  const server = new OverlayExpress('Server Name')
  await server.configureKnex({
    //...
  })
  await server.configureMongo('mongodb://...')
  await server.configureEngine()
  await server.start()
})()
```

## License

The license for the code in this repository is the Open BSV License. Refer to [LICENSE.txt](./LICENSE.txt) for the license text.

Thank you for being a part of the BSV Blockchain Overlay Express Project. Let's build the future of BSV Blockchain together!
