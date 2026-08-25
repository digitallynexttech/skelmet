/**
 * Brand glyphs drawn inline. lucide-react 1.x dropped its brand set, and a
 * hand-drawn mark keeps the stroke weight consistent with the rest of the icons.
 */

type IconProps = { className?: string }

export function InstagramIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      aria-hidden="true"
      className={className}
    >
      <rect x="2" y="2" width="20" height="20" rx="5.5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.6" cy="6.4" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function YoutubeIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="2" y="5" width="20" height="14" rx="4.5" />
      <path d="M10.2 9.3v5.4l4.6-2.7z" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function WhatsappIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M21 11.5a8.4 8.4 0 0 1-12.3 7.4L3 21l2.2-5.5A8.4 8.4 0 1 1 21 11.5Z" />
      <path d="M8.9 9.2c.2-.5.4-.5.7-.5h.5c.2 0 .4 0 .6.5l.6 1.4c.1.2 0 .4-.1.5l-.4.5c-.1.1-.2.3-.1.5.3.6 1.1 1.5 2 1.9.2.1.4 0 .5-.1l.4-.5c.2-.2.3-.2.5-.1l1.3.7c.4.2.4.4.4.6 0 .3-.2.8-.4 1-.3.2-.8.5-1.3.5-1.2 0-2.9-.9-4-2-1.1-1.1-1.9-2.4-1.9-3.4 0-.5.2-1 .4-1.2z" />
    </svg>
  )
}
