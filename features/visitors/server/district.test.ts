import { describe, expect, it, vi } from "vitest"

vi.mock("@/server/db", () => ({ db: {} }))

const { placeFromIndiaPost, visitPincode } = await import("@/features/visitors/server/district")

const office = (District: string, DeliveryStatus = "Delivery", State = "Delhi") => ({
  Name: "x",
  District,
  State,
  DeliveryStatus,
})

describe("placeFromIndiaPost", () => {
  it("takes the district most of the pincode's post offices are in", () => {
    const body = [
      {
        Status: "Success",
        PostOffice: [office("South Delhi"), office("South Delhi"), office("South East Delhi")],
      },
    ]
    expect(placeFromIndiaPost(body)).toEqual({ district: "South Delhi", state: "Delhi" })
  })

  it("prefers offices that deliver over those that do not", () => {
    const body = [
      {
        Status: "Success",
        PostOffice: [
          office("Gautam Buddha Nagar", "Delivery", "Uttar Pradesh"),
          office("Ghaziabad", "Non-Delivery", "Uttar Pradesh"),
          office("Ghaziabad", "Non-Delivery", "Uttar Pradesh"),
        ],
      },
    ]
    expect(placeFromIndiaPost(body)?.district).toBe("Gautam Buddha Nagar")
  })

  it("is null for a pincode India Post does not know, or an answer it cannot read", () => {
    expect(placeFromIndiaPost([{ Status: "Error", PostOffice: null }])).toBeNull()
    expect(placeFromIndiaPost({})).toBeNull()
    expect(placeFromIndiaPost(null)).toBeNull()
  })
})

describe("visitPincode", () => {
  it("takes an Indian six-digit pincode from Cloudflare", () => {
    expect(visitPincode({ country: "IN", postalCode: "110044" })).toBe("110044")
    expect(visitPincode({ country: null, postalCode: " 201301 " })).toBe("201301")
  })

  it("ignores other countries' postcodes and anything malformed", () => {
    expect(visitPincode({ country: "US", postalCode: "940101" })).toBeNull()
    expect(visitPincode({ country: "IN", postalCode: "0110" })).toBeNull()
    expect(visitPincode({ country: "IN", postalCode: null })).toBeNull()
  })
})
