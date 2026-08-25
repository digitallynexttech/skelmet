// Public API of the catalogue feature. Named exports only, never `export *`,
// and never the server/ or emails/ folders (§4).
export { ProductDetail } from "@/features/catalog/components/product-detail"
export {
  COLOURWAYS,
  FLAME_SKULL_MOUNT,
  PRODUCTS,
  getColourway,
  getProduct,
  resolveColourway,
} from "@/features/catalog/catalog"
export type { Colourway, ColourwayId, Product } from "@/features/catalog/catalog"
