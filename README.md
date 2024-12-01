# Overlay Express

BSV BLOCKCHAIN | Overlay Express

An opinionated but configurable Overlay Services deployment system:
- Uses express for HTTP(S)
- Implements a configurable web UI
- Uses common MySQL and Mongo databases
- Supports SHIP, SLAP, GASP out of the box (or not)
- Supports Arc callbacks natively (or not)

## Example Usage

Here's a quick example that uses Ngrok and some common environment variables.

```typescript
import OverlayExpress from '@bsv/overlay-express'
import ngrok from 'ngrok'
import dotenv from 'dotenv'
dotenv.config()

const main = async () => {
    const ngrokUrl = await ngrok.connect(3000)
    console.log(ngrokUrl)
    const server = new OverlayExpress('Server Name', process.env.SERVER_PRIVATE_KEY!, ngrokUrl)
    await server.configureKnex(process.env.KNEX_URL!)
    await server.configureMongo(process.env.MONGO_URL!)
    await server.configureEngine()
    await server.start()
}
main()
```

## License

The license for the code in this repository is the Open BSV License. Refer to [LICENSE.txt](./LICENSE.txt) for the license text.

Thank you for being a part of the BSV Blockchain Overlay Express Project. Let's build the future of BSV Blockchain together!
