# sp-airline-ndc

Hosted **IATA NDC 21.3 JSON** mock airline for the Softprobe travel-ota demo.

- **Production:** https://spair.softprobe.ai
- **API docs:** https://spair.softprobe.ai/docs
- **Health:** https://spair.softprobe.ai/health

Replaces the local Java `sp-airline` container — travel-ota calls this worker over HTTPS.

## Deploy

```bash
npm install
npm test
npx wrangler login
npm run deploy
```

Requires Cloudflare account with `softprobe.ai` zone (see `wrangler.toml`).

## Local dev

```bash
npm run dev
# POST http://127.0.0.1:8787/ndc/v21.3/airshopping
```

## NDC endpoints

| POST path | Message |
|-----------|---------|
| `/ndc/v21.3/airshopping` | AirShoppingRQ → RS |
| `/ndc/v21.3/offerprice` | OfferPriceRQ → RS |
| `/ndc/v21.3/ordercreate` | OrderCreateRQ → OrderViewRS |
| `/ndc/v21.3/orderchange` | OrderChangeRQ → OrderViewRS |
| `/ndc/v21.3/orderretrieve` | OrderRetrieveRQ → OrderViewRS |
| `/ndc/v21.3/ordercancel` | OrderCancelRQ → OrderViewRS |
| `/ndc/v21.3/servicelist` | ServiceListRQ → RS |

State is persisted in a Cloudflare Durable Object (`AirlineStore`).
