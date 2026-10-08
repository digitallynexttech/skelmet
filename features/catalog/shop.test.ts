import { describe, expect, it } from "vitest"

import { FLAME_SKULL_MOUNT, PISTON_SKULL_MOUNT, type Product } from "@/features/catalog/catalog"
import {
  NO_FILTERS,
  parseShopQuery,
  shopResults,
  shopSearch,
  toggleColour,
  type ShopQuery,
} from "@/features/catalog/shop"

// The registry as it stands: the Flame Skull in stock, the Piston Skull not yet.
const PRODUCTS = [FLAME_SKULL_MOUNT, PISTON_SKULL_MOUNT]
const cards = (products: Product[], search: string) =>
  shopResults(products, parseShopQuery(search)).map(
    ({ product, colourway }) => `${product.slug}:${colourway.id}`,
  )

const priced = (product: Product, price: string, inStock = true): Product => ({
  ...product,
  colourways: product.colourways.map((c) => ({ ...c, price, inStock })),
})

describe("shop query", () => {
  it("round-trips through the URL, leaving defaults out", () => {
    const query: ShopQuery = {
      q: "piston",
      colours: ["olive", "ghost"],
      inStock: true,
      sort: "price-desc",
    }
    expect(parseShopQuery(shopSearch(query))).toEqual(query)
    // The footer's links name one colour; a comma list reads too.
    expect(parseShopQuery("?colour=ghost,blaze").colours).toEqual(["blaze", "ghost"])
    expect(shopSearch(NO_FILTERS)).toBe("")
  })

  it("switches a colour on and off in the catalogue's order", () => {
    expect(toggleColour(["ghost"], "blaze")).toEqual(["blaze", "ghost"])
    expect(toggleColour(["blaze", "ghost"], "blaze")).toEqual(["ghost"])
  })

  it("ignores values it does not know", () => {
    expect(parseShopQuery("?colour=pink&sort=random&stock=yes")).toEqual(NO_FILTERS)
  })
})

describe("shop results", () => {
  it("lists every product, sold out last", () => {
    expect(cards([PISTON_SKULL_MOUNT, FLAME_SKULL_MOUNT], "")).toEqual([
      "flame-skull-mount:blaze",
      "piston-skull-mount:blaze",
    ])
  })

  it("shows each product in the colour asked for", () => {
    expect(cards(PRODUCTS, "?colour=ghost")).toEqual([
      "flame-skull-mount:ghost",
      "piston-skull-mount:ghost",
    ])
  })

  it("opens each product on the first of several colours asked for", () => {
    expect(cards(PRODUCTS, "?colour=ghost&colour=olive")).toEqual([
      "flame-skull-mount:olive",
      "piston-skull-mount:olive",
    ])
  })

  it("drops what is sold out when asked", () => {
    expect(cards(PRODUCTS, "?stock=in")).toEqual(["flame-skull-mount:blaze"])
  })

  it("searches the product's words and narrows by a colour's name", () => {
    expect(cards(PRODUCTS, "?q=piston")).toEqual(["piston-skull-mount:blaze"])
    expect(cards(PRODUCTS, "?q=Piston+OLIVE")).toEqual(["piston-skull-mount:olive"])
    expect(cards(PRODUCTS, "?q=grey")).toEqual([
      "flame-skull-mount:ghost",
      "piston-skull-mount:ghost",
    ])
    expect(cards(PRODUCTS, "?q=unicorn")).toEqual([])
  })

  it("sorts by price and by name", () => {
    const cheap = priced(PISTON_SKULL_MOUNT, "2999")
    const dear = priced(FLAME_SKULL_MOUNT, "3999")
    expect(cards([dear, cheap], "?sort=price-asc")).toEqual([
      "piston-skull-mount:blaze",
      "flame-skull-mount:blaze",
    ])
    expect(cards([cheap, dear], "?sort=price-desc")).toEqual([
      "flame-skull-mount:blaze",
      "piston-skull-mount:blaze",
    ])
    expect(cards([cheap, dear], "?sort=name")).toEqual([
      "flame-skull-mount:blaze",
      "piston-skull-mount:blaze",
    ])
  })

  it("keeps sold out last whatever the sort", () => {
    const cheapSoldOut = priced(PISTON_SKULL_MOUNT, "999", false)
    expect(cards([cheapSoldOut, FLAME_SKULL_MOUNT], "?sort=price-asc")).toEqual([
      "flame-skull-mount:blaze",
      "piston-skull-mount:blaze",
    ])
  })
})
