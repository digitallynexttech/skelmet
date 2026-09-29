"use client"

import * as React from "react"
import Image from "@tiptap/extension-image"
import { Placeholder } from "@tiptap/extensions"
import {
  EditorContent,
  useEditor,
  useEditorState,
  type Editor,
  type JSONContent,
} from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import {
  Bold,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  NEWSLETTER_IMAGE_MAX_BYTES,
  NEWSLETTER_IMAGE_TYPES,
} from "@/features/newsletter/schemas/newsletter.schema"
import { apiFetch, ApiFetchError } from "@/lib/api-fetch"
import { cn } from "@/lib/utils"

/**
 * The newsletter's message editor: TipTap (ProseMirror underneath), holding a
 * JSON document rather than HTML.
 *
 * It offers exactly what the email can render (newsletter-content.ts) - bold,
 * italic, underline, strike, links, two heading sizes, lists, quotes, a divider
 * and pictures - and nothing that would be dropped on the way to the inbox.
 * Code and code blocks are left out; a pasted table or colour simply does not
 * come across.
 *
 * Pictures are uploaded as they are added, from the toolbar, a paste or a
 * drop, and go in as links to the shop's own copy: a picture pasted inline as
 * data would be stripped by Gmail and Outlook.
 */

type UploadedImage = { id: string; url: string; width: number; height: number }

export const EMPTY_DOC: JSONContent = { type: "doc", content: [{ type: "paragraph" }] }

export function RichEditor({
  initial,
  onChange,
  invalid,
  placeholder,
}: {
  /** Read once, when the editor is made. Remount (change the key) to load another. */
  initial: JSONContent
  onChange: (doc: JSONContent) => void
  invalid?: boolean
  placeholder?: string
}) {
  const onChangeRef = React.useRef(onChange)
  React.useEffect(() => {
    onChangeRef.current = onChange
  })
  const editorRef = React.useRef<Editor | null>(null)
  const fileRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(0)
  const [linking, setLinking] = React.useState(false)

  const upload = React.useCallback(async (files: File[]) => {
    for (const file of files) {
      if (!NEWSLETTER_IMAGE_TYPES.includes(file.type)) {
        toast.error(`${file.name} is not a JPG, PNG, WebP or GIF picture.`)
        continue
      }
      if (file.size > NEWSLETTER_IMAGE_MAX_BYTES) {
        toast.error(`${file.name} is over 8 MB. Use a smaller picture.`)
        continue
      }
      setUploading((n) => n + 1)
      try {
        const form = new FormData()
        form.append("file", file)
        const image = await apiFetch<UploadedImage>("/api/admin/newsletter/images", {
          method: "POST",
          body: form,
        })
        editorRef.current
          ?.chain()
          .focus()
          .setImage({
            src: image.url,
            alt: file.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " "),
            width: image.width,
            height: image.height,
          })
          .run()
      } catch (err) {
        toast.error(err instanceof ApiFetchError ? err.message : `${file.name} did not upload.`)
      } finally {
        setUploading((n) => n - 1)
      }
    }
  }, [])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        code: false,
        codeBlock: false,
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
      Image.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({ placeholder: placeholder ?? "Write your message" }),
    ],
    content: initial,
    // Rendered on the client only: the console page is a client component,
    // and TipTap warns when it would render on the server.
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChangeRef.current(editor.getJSON()),
    editorProps: {
      attributes: { "aria-label": "Message", "aria-multiline": "true" },
      handlePaste: (_view, event) => {
        const files = pictures(event.clipboardData?.files)
        if (!files.length) return false
        void upload(files)
        return true
      },
      handleDrop: (_view, event) => {
        const files = pictures((event as DragEvent).dataTransfer?.files)
        if (!files.length) return false
        event.preventDefault()
        void upload(files)
        return true
      },
    },
  })

  React.useEffect(() => {
    editorRef.current = editor
  }, [editor])

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            underline: e.isActive("underline"),
            strike: e.isActive("strike"),
            h2: e.isActive("heading", { level: 2 }),
            h3: e.isActive("heading", { level: 3 }),
            bullet: e.isActive("bulletList"),
            ordered: e.isActive("orderedList"),
            quote: e.isActive("blockquote"),
            link: e.isActive("link"),
            href: (e.getAttributes("link").href as string | undefined) ?? "",
            canUndo: e.can().undo(),
            canRedo: e.can().redo(),
          }
        : null,
  })

  const run = (fn: (e: Editor) => void) => () => {
    if (editor) fn(editor)
  }

  return (
    <div
      className={cn(
        "rich-editor bg-void rounded-field border transition-colors",
        invalid ? "border-magenta" : "focus-within:border-blaze border-white/[0.14]",
      )}
    >
      <div
        role="toolbar"
        aria-label="Formatting"
        className="flex flex-wrap items-center gap-0.5 border-b border-white/[0.1] px-2 py-1.5"
      >
        <Tool
          icon={Bold}
          label="Bold"
          active={state?.bold}
          onClick={run((e) => e.chain().focus().toggleBold().run())}
        />
        <Tool
          icon={Italic}
          label="Italic"
          active={state?.italic}
          onClick={run((e) => e.chain().focus().toggleItalic().run())}
        />
        <Tool
          icon={Underline}
          label="Underline"
          active={state?.underline}
          onClick={run((e) => e.chain().focus().toggleUnderline().run())}
        />
        <Tool
          icon={Strikethrough}
          label="Strikethrough"
          active={state?.strike}
          onClick={run((e) => e.chain().focus().toggleStrike().run())}
        />
        <Divider />
        <Tool
          icon={Heading2}
          label="Heading"
          active={state?.h2}
          onClick={run((e) => e.chain().focus().toggleHeading({ level: 2 }).run())}
        />
        <Tool
          icon={Heading3}
          label="Subheading"
          active={state?.h3}
          onClick={run((e) => e.chain().focus().toggleHeading({ level: 3 }).run())}
        />
        <Tool
          icon={List}
          label="Bulleted list"
          active={state?.bullet}
          onClick={run((e) => e.chain().focus().toggleBulletList().run())}
        />
        <Tool
          icon={ListOrdered}
          label="Numbered list"
          active={state?.ordered}
          onClick={run((e) => e.chain().focus().toggleOrderedList().run())}
        />
        <Tool
          icon={Quote}
          label="Quote"
          active={state?.quote}
          onClick={run((e) => e.chain().focus().toggleBlockquote().run())}
        />
        <Tool
          icon={Minus}
          label="Divider"
          onClick={run((e) => e.chain().focus().setHorizontalRule().run())}
        />
        <Divider />
        <Tool
          icon={Link2}
          label="Link"
          active={state?.link || linking}
          onClick={() => setLinking((v) => !v)}
        />
        <Tool
          icon={ImagePlus}
          label={uploading ? "Uploading picture" : "Add a picture"}
          busy={uploading > 0}
          onClick={() => fileRef.current?.click()}
        />
        <Divider />
        <Tool
          icon={Undo2}
          label="Undo"
          disabled={!state?.canUndo}
          onClick={run((e) => e.chain().focus().undo().run())}
        />
        <Tool
          icon={Redo2}
          label="Redo"
          disabled={!state?.canRedo}
          onClick={run((e) => e.chain().focus().redo().run())}
        />
        {uploading ? <span className="text-dim ml-2 font-mono text-[11px]">Uploading…</span> : null}
        <input
          ref={fileRef}
          type="file"
          accept={NEWSLETTER_IMAGE_TYPES.join(",")}
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            e.target.value = ""
            void upload(files)
          }}
        />
      </div>

      {linking && editor ? (
        <LinkBar
          key={state?.href}
          current={state?.href ?? ""}
          onApply={(href) => {
            const { empty } = editor.state.selection
            if (empty && !editor.isActive("link")) {
              // Nothing selected: the address goes in as its own linked text.
              editor
                .chain()
                .focus()
                .insertContent({
                  type: "text",
                  text: href,
                  marks: [{ type: "link", attrs: { href } }],
                })
                .run()
            } else {
              editor.chain().focus().extendMarkRange("link").setLink({ href }).run()
            }
            setLinking(false)
          }}
          onRemove={() => {
            editor.chain().focus().extendMarkRange("link").unsetLink().run()
            setLinking(false)
          }}
          onClose={() => setLinking(false)}
        />
      ) : null}

      <EditorContent editor={editor} />
    </div>
  )
}

function pictures(list: FileList | null | undefined): File[] {
  return Array.from(list ?? []).filter((f) => f.type.startsWith("image/"))
}

function Tool({
  icon: Icon,
  label,
  active,
  disabled,
  busy,
  onClick,
}: {
  icon: LucideIcon
  label: string
  active?: boolean
  disabled?: boolean
  busy?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      // Keeps the text selection: a mousedown on the button would move focus
      // out of the editor and lose what the format is meant to apply to.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex size-8 items-center justify-center rounded-md transition-colors disabled:opacity-30",
        active ? "bg-blaze/15 text-blaze" : "text-ash hover:text-bone hover:bg-white/[0.06]",
        busy && "animate-pulse",
      )}
    >
      <Icon className="size-4" strokeWidth={2} />
    </button>
  )
}

function Divider() {
  return <span aria-hidden className="mx-1 h-5 w-px bg-white/[0.1]" />
}

/** A web address on its own gets https:// in front, as a browser would. */
function normaliseHref(raw: string): string | null {
  const v = raw.trim()
  if (!v) return null
  if (/^(https?:\/\/|mailto:)/i.test(v)) return v
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return `mailto:${v}`
  if (/^[^\s]+\.[^\s]+/.test(v)) return `https://${v}`
  return null
}

function LinkBar({
  current,
  onApply,
  onRemove,
  onClose,
}: {
  current: string
  onApply: (href: string) => void
  onRemove: () => void
  onClose: () => void
}) {
  const [value, setValue] = React.useState(current)
  const [error, setError] = React.useState(false)

  const apply = () => {
    const href = normaliseHref(value)
    if (!href) {
      setError(true)
      return
    }
    onApply(href)
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.1] px-3 py-2">
      <input
        autoFocus
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          setError(false)
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            apply()
          }
          if (e.key === "Escape") onClose()
        }}
        placeholder="https://www.skelmet.in/product/flame-skull-mount"
        aria-label="Link address"
        aria-invalid={error || undefined}
        className={cn(
          "bg-carbon text-bone h-9 min-w-0 flex-1 rounded-md border px-3 font-mono text-[12.5px] outline-none",
          error ? "border-magenta" : "focus:border-blaze border-white/[0.14]",
        )}
      />
      <button
        type="button"
        onClick={apply}
        className="bg-blaze text-void h-9 rounded-md px-3 text-[12.5px] font-semibold"
      >
        Apply
      </button>
      {current ? (
        <button
          type="button"
          onClick={onRemove}
          className="text-ash hover:text-bone h-9 rounded-md border border-white/[0.14] px-3 text-[12.5px]"
        >
          Remove link
        </button>
      ) : null}
      {error ? (
        <span className="text-magenta w-full text-[12px]">
          Use a web address like www.skelmet.in or an email address.
        </span>
      ) : null}
    </div>
  )
}
