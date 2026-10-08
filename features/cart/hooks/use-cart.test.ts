import { describe, expect, it } from "vitest"

import { lineFor } from "@/features/cart/hooks/use-cart"
import { buyNowHref } from "@/features/catalog/hooks/use-buy-selection"

// Two products share colourway ids; with no product named, a line means the Flame Skull.
describe("lineFor", () => {
  it("is the named product's colourway, under its own SKU", () => {
    expect(lineFor("olive", 2, "piston-skull-mount")).toMatchObject({
      id: "piston-skull-mount:olive",
      productName: "Piston Skull Helmet Mount",
      sku: "SKM-PST-OLV",
      qty: 2,
    })
  })

  it("is the Flame Skull's when no product is named", () => {
    expect(lineFor("blaze", 1)).toMatchObject({
      id: "flame-skull-mount:blaze",
      sku: "SKM-BLZ",
    })
  })

  it("keeps the two products' lines apart in the same colourway", () => {
    expect(lineFor("ghost", 1)!.id).not.toBe(lineFor("ghost", 1, "piston-skull-mount")!.id)
  })

  it("refuses a product or colourway that does not exist", () => {
    expect(lineFor("blaze", 1, "no-such-mount")).toBeNull()
    expect(lineFor("chrome", 1, "piston-skull-mount")).toBeNull()
  })
})

describe("buyNowHref", () => {
  it("names the product, so checkout buys the right skull", () => {
    expect(buyNowHref("ghost", 3, "piston-skull-mount")).toBe(
      "/checkout?buy=ghost&qty=3&product=piston-skull-mount",
    )
  })
})
