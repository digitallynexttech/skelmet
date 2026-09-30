import { defineField, defineType } from "sanity"

/** Who wrote a post. Optional on a post: without one it is signed SKELMET. */
export const author = defineType({
  name: "author",
  title: "Author",
  type: "document",
  fields: [
    defineField({ name: "name", type: "string", validation: (rule) => rule.required() }),
    defineField({
      name: "role",
      type: "string",
      description: "Shown under the name, e.g. Founder or Rider.",
    }),
    defineField({
      name: "bio",
      type: "text",
      rows: 3,
      description: "A couple of lines, shown at the end of their posts.",
    }),
    defineField({ name: "photo", type: "image", options: { hotspot: true } }),
  ],
  preview: { select: { title: "name", subtitle: "role", media: "photo" } },
})
