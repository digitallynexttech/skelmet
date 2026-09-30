import type { ReactNode } from "react"
import Link from "next/link"
import { PortableText, type PortableTextComponents } from "@portabletext/react"

import { extractHeadings, type PortableBlock, type SanityImage } from "@/features/blog/blog"
import { SanityImage as Picture } from "@/features/blog/components/sanity-image"
import { imageDimensions, imageUrl } from "@/features/blog/lib/image"

/** The widest a picture in the body is drawn, and so the widest it is asked for. */
const BODY_IMAGE_WIDTH = 1440

type BlockProps = { children?: ReactNode; value?: { _key?: string } }

/**
 * How each piece of a post's body is drawn. Rendered on the server: Portable
 * Text needs nothing in the browser.
 *
 * `headingIds` maps a heading block's _key to its anchor (extractHeadings), so
 * the "On this page" list can link to it. scroll-mt clears the sticky header
 * when one is jumped to.
 */
function components(headingIds: Map<string, string>): PortableTextComponents {
  const idOf = (value?: { _key?: string }) => (value?._key ? headingIds.get(value._key) : undefined)

  return {
    types: {
      image: ({ value }: { value: SanityImage }) => {
        const url = imageUrl(value, { width: BODY_IMAGE_WIDTH })
        if (!url) return null
        // The original's own shape, so the space is held before it loads.
        const size = imageDimensions(value) ?? { width: 16, height: 9 }
        const width = Math.min(size.width, BODY_IMAGE_WIDTH)
        const height = Math.round((size.height / size.width) * width)
        return (
          <figure className="my-10">
            <Picture
              src={url}
              alt={value.alt ?? ""}
              width={width}
              height={height}
              sizes="(min-width: 1024px) 760px, 100vw"
              className="rounded-tile h-auto w-full border border-white/[0.09]"
            />
            {value.caption ? (
              <figcaption className="text-dim mt-3 text-center text-[13px] leading-[1.5]">
                {value.caption}
              </figcaption>
            ) : null}
          </figure>
        )
      },
    },
    block: {
      normal: ({ children }: BlockProps) => (
        <p className="text-ash my-5 text-[17px] leading-[1.8]">{children}</p>
      ),
      h2: ({ children, value }: BlockProps) => (
        <h2
          id={idOf(value)}
          className="font-display text-bone mt-14 mb-5 scroll-mt-28 text-[30px] leading-[1.08] uppercase sm:text-[36px]"
        >
          {children}
        </h2>
      ),
      h3: ({ children, value }: BlockProps) => (
        <h3
          id={idOf(value)}
          className="text-bone mt-10 mb-3 scroll-mt-28 text-[21px] leading-[1.3] font-bold"
        >
          {children}
        </h3>
      ),
      blockquote: ({ children }: BlockProps) => (
        <blockquote className="border-blaze text-bone my-8 border-l-[3px] py-1 pl-6 text-[19px] leading-[1.6] italic">
          {children}
        </blockquote>
      ),
    },
    marks: {
      strong: ({ children }) => <strong className="text-bone font-semibold">{children}</strong>,
      em: ({ children }) => <em>{children}</em>,
      link: ({ value, children }: { value?: { href?: string }; children?: ReactNode }) => {
        const href = value?.href ?? "#"
        const className =
          "text-ember decoration-ember/40 hover:text-bone underline underline-offset-[3px] transition-colors"
        // A page of this site stays in this tab and is prefetched; anything
        // else opens beside it, without handing over the referrer.
        return href.startsWith("/") ? (
          <Link href={href} className={className}>
            {children}
          </Link>
        ) : (
          <a href={href} className={className} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        )
      },
    },
    list: {
      bullet: ({ children }) => (
        <ul className="text-ash marker:text-blaze my-5 ml-5 list-disc space-y-2 text-[17px] leading-[1.75]">
          {children}
        </ul>
      ),
      number: ({ children }) => (
        <ol className="text-ash marker:text-ember my-5 ml-5 list-decimal space-y-2 text-[17px] leading-[1.75] marker:font-mono marker:text-[14px]">
          {children}
        </ol>
      ),
    },
    listItem: {
      bullet: ({ children }) => <li className="pl-1.5">{children}</li>,
      number: ({ children }) => <li className="pl-1.5">{children}</li>,
    },
  }
}

/** A post's body. */
export function PostBody({ body }: { body: PortableBlock[] }) {
  const headingIds = new Map(extractHeadings(body).map((h) => [h.key, h.id]))
  return <PortableText value={body} components={components(headingIds)} />
}
