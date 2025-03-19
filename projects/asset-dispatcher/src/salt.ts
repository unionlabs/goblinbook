import { toHex, type Hex } from "viem"

export function generateSalt() {
  const rawSalt = new Uint8Array(32)
  crypto.getRandomValues(rawSalt)
  return toHex(rawSalt) as Hex
}
