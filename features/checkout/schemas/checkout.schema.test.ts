import { describe, expect, it } from "vitest"

import { addressSchema, placeOrderSchema } from "@/features/checkout/schemas/checkout.schema"

/**
 * The rules the checkout page shows under each field, and the server applies
 * again - one schema, so what the page lets through is what the server takes.
 */

const address = {
  firstName: "Asha",
  lastName: "Rao",
  line1: "12 MG Road",
  line2: "",
  city: "South Delhi",
  state: "Delhi",
  pincode: "110044",
}

const order = {
  email: "asha@example.com",
  phone: "9876543210",
  address,
  items: [{ sku: "SKM-BLZ", qty: 1 }],
  paymentMethod: "ONLINE",
}

const phoneProblem = (phone: string) => {
  const r = placeOrderSchema.shape.phone.safeParse(phone)
  return r.success ? null : r.error.issues[0]?.message
}

const pincodeProblem = (pincode: string) => {
  const r = addressSchema.shape.pincode.safeParse(pincode)
  return r.success ? null : r.error.issues[0]?.message
}

describe("the checkout form's rules", () => {
  it("takes a complete, sensible order", () => {
    expect(placeOrderSchema.safeParse(order).success).toBe(true)
  })

  it("wants a real email", () => {
    expect(placeOrderSchema.safeParse({ ...order, email: "asha@" }).success).toBe(false)
    expect(placeOrderSchema.safeParse({ ...order, email: "not an email" }).success).toBe(false)
  })

  it("wants exactly ten digits for the phone, with no +91, 0 or letters", () => {
    expect(phoneProblem("9876543210")).toBeNull()
    expect(phoneProblem("+919876543210")).toMatch(/10-digit/)
    expect(phoneProblem("+91 9876543210")).toMatch(/10-digit/)
    expect(phoneProblem("09876543210")).toMatch(/10-digit/)
    expect(phoneProblem("98765432101")).toMatch(/10-digit/)
    expect(phoneProblem("987654321")).toMatch(/10-digit/)
    expect(phoneProblem("98765abcde")).toMatch(/10-digit/)
  })

  it("wants a mobile number to start with 6 to 9", () => {
    expect(phoneProblem("1234567890")).toMatch(/start with 6, 7, 8 or 9/)
    expect(phoneProblem("6000000000")).toBeNull()
  })

  it("names one problem at a time, not every rule a value breaks", () => {
    const phone = placeOrderSchema.shape.phone.safeParse("+919876543210")
    expect(phone.success ? [] : phone.error.issues.map((i) => i.message)).toEqual([
      "Enter your 10-digit mobile number, without +91 or 0",
    ])
    const pin = addressSchema.shape.pincode.safeParse("0110")
    expect(pin.success ? [] : pin.error.issues.map((i) => i.message)).toEqual([
      "Enter your 6-digit pincode",
    ])
  })

  it("wants exactly six digits for the pincode, not starting with 0", () => {
    expect(pincodeProblem("110044")).toBeNull()
    expect(pincodeProblem("11004")).toMatch(/6-digit/)
    expect(pincodeProblem("1100445")).toMatch(/6-digit/)
    expect(pincodeProblem("11O044")).toMatch(/6-digit/)
    expect(pincodeProblem("011004")).toMatch(/never starts with 0/)
  })

  it("wants the state to be a real one, spelled as the list spells it", () => {
    expect(addressSchema.safeParse({ ...address, state: "Uttarakhand" }).success).toBe(true)
    expect(addressSchema.safeParse({ ...address, state: "hoihdlv" }).success).toBe(false)
    expect(addressSchema.safeParse({ ...address, state: "" }).success).toBe(false)
  })

  it("wants letters for the city", () => {
    expect(addressSchema.safeParse({ ...address, city: "Port Blair" }).success).toBe(true)
    expect(addressSchema.safeParse({ ...address, city: "Badarpur (South Delhi)" }).success).toBe(
      true,
    )
    expect(addressSchema.safeParse({ ...address, city: "12345" }).success).toBe(false)
    expect(addressSchema.safeParse({ ...address, city: "d" }).success).toBe(false)
  })
})
