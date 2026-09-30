import { defineArrayMember, defineField, defineType } from "sanity"

// Relative, as everything the Studio config reaches is: see ../env.ts.
import { BLOG_CATEGORIES, isPostSlug } from "../../blog"

/**
 * A blog post, as the Studio edits it.
 *
 * Kept to what the site shows. There is no read-time field - it is worked out
 * from the body (server/sanity.ts) - and no separate SEO title: the title and
 * the excerpt are what search results and share cards use, so there is one
 * place to get them right.
 */
export const post = defineType({
  name: "post",
  title: "Post",
  type: "document",
  fields: [
    defineField({
      name: "title",
      type: "string",
      validation: (rule) => rule.required().max(110),
    }),
    defineField({
      name: "slug",
      type: "slug",
      description:
        "The address of the post: skelmet.in/blog/<slug>. Leave it alone once published.",
      options: { source: "title", maxLength: 80 },
      // The site answers 404 for any other shape of address (isPostSlug), so
      // a slug typed by hand with capitals or spaces would publish a post
      // nobody can open.
      validation: (rule) =>
        rule
          .required()
          .custom((slug) =>
            !slug?.current || isPostSlug(slug.current)
              ? true
              : "Lower-case letters, numbers and single hyphens only, e.g. how-to-clean-a-visor",
          ),
    }),
    defineField({
      name: "excerpt",
      type: "text",
      rows: 3,
      description: "One or two sentences. Shown on the blog page, in Google and when shared.",
      validation: (rule) => rule.required().max(200),
    }),
    defineField({
      name: "category",
      type: "string",
      options: {
        list: BLOG_CATEGORIES.map((c) => ({ title: c.label, value: c.value })),
        layout: "radio",
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "coverImage",
      title: "Cover image",
      type: "image",
      description: "Shown 16:9. Set the hotspot so the crop keeps what matters.",
      options: { hotspot: true },
      fields: [
        defineField({
          name: "alt",
          title: "Alt text",
          type: "string",
          description: "What the picture shows, for people who cannot see it.",
        }),
      ],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "publishedAt",
      title: "Published at",
      type: "datetime",
      description:
        "When the post goes on the site. Publish it with a time in the future and it stays off the site until then: that is how a post is scheduled. The console's Blog page sets this too.",
      initialValue: () => new Date().toISOString(),
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "author",
      type: "reference",
      to: [{ type: "author" }],
      description: "Optional. Without one the post is signed SKELMET.",
    }),
    defineField({
      name: "featured",
      type: "boolean",
      description: "Show it large at the top of the blog page.",
      initialValue: false,
    }),
    defineField({
      name: "body",
      type: "array",
      validation: (rule) => rule.required(),
      of: [
        defineArrayMember({
          type: "block",
          styles: [
            { title: "Normal", value: "normal" },
            { title: "Heading", value: "h2" },
            { title: "Sub-heading", value: "h3" },
            { title: "Quote", value: "blockquote" },
          ],
          lists: [
            { title: "Bullets", value: "bullet" },
            { title: "Numbered", value: "number" },
          ],
          marks: {
            decorators: [
              { title: "Bold", value: "strong" },
              { title: "Italic", value: "em" },
            ],
            annotations: [
              defineArrayMember({
                name: "link",
                type: "object",
                title: "Link",
                fields: [
                  defineField({
                    name: "href",
                    type: "url",
                    title: "URL",
                    description:
                      "A full address, or a page on this site such as /product/flame-skull-mount.",
                    validation: (rule) =>
                      rule
                        .required()
                        .uri({ allowRelative: true, scheme: ["http", "https", "mailto", "tel"] }),
                  }),
                ],
              }),
            ],
          },
        }),
        defineArrayMember({
          type: "image",
          options: { hotspot: true },
          fields: [
            defineField({ name: "alt", title: "Alt text", type: "string" }),
            defineField({ name: "caption", type: "string" }),
          ],
        }),
      ],
    }),
  ],
  orderings: [
    {
      title: "Published, newest first",
      name: "publishedAtDesc",
      by: [{ field: "publishedAt", direction: "desc" }],
    },
  ],
  preview: {
    select: { title: "title", category: "category", media: "coverImage", date: "publishedAt" },
    prepare({ title, category, media, date }) {
      const day = date
        ? new Date(date).toLocaleDateString("en-IN", { dateStyle: "medium" })
        : "No date"
      const label = BLOG_CATEGORIES.find((c) => c.value === category)?.label ?? "No category"
      return { title, subtitle: `${label} · ${day}`, media }
    },
  },
})
