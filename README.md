# Overlay Express

BSV BLOCKCHAIN | Overlay Express

An opinionated but configurable Overlay Services deployment system:
- Uses express for HTTP(S)
- Implements a configurable web UI
- Uses common MySQL and Mongo databases
- Supports SHIP, SLAP, GASP out of the box (or not)
- Supports Arc callbacks natively (or not)

## Example Usage

Here's a quick example:

```typescript
import OverlayExpress from '@bsv/overlay-express'
import dotenv from 'dotenv'
dotenv.config()
import { AdmittanceInstructions } from '@bsv/sdk'

const main = async () => {
    const server = new OverlayExpress(
        `Ty's Overlay Service`,
        process.env.SERVER_PRIVATE_KEY!,
        process.env.HOSTING_URL!
    )
    server.configurePort(8080)
    server.configureWebUI({
        backgroundColor: '#000',
        faviconUrl: 'https://tyweb.us/ty.jpg'
    })
    await server.configureKnex(process.env.KNEX_URL!)
    await server.configureMongo(process.env.MONGO_URL!)
    server.configureTopicManager('tm_meter', {
        identifyAdmissibleOutputs: async (beef: number[], previousCoins: number[]): Promise<AdmittanceInstructions> => {
            return {
                outputsToAdmit: [],
                coinsToRetain: []
            }
        },
        getDocumentation: async (): Promise<string> => {
            return '# Meter Docs'
        },
        getMetaData: async () => {
            return {
                name: 'Meter',
                shortDescription: 'Meters, up and down.'
            }
        }
    })
    await server.configureEngine()
    await server.start()
}
main()
```

## Full API Docs

Check out [API.md](./API.md) for the API docs.

## License

The license for the code in this repository is the Open BSV License. Refer to [LICENSE.txt](./LICENSE.txt) for the license text.

Thank you for being a part of the BSV Blockchain Overlay Express Project. Let's build the future of BSV Blockchain together!
