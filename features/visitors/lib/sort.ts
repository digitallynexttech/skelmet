/** Columns the visitor list sorts by in the database. "In cart" is summed per row, so it cannot. */
export const VISITOR_SORTS = [
  "visitor",
  "place",
  "device",
  "source",
  "visits",
  "pages",
  "time",
  "seen",
] as const

export type VisitorSort = (typeof VISITOR_SORTS)[number]
