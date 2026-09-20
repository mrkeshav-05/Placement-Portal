"use client";

import { Link as LinkExtension } from "@tiptap/extension-link";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Underline as UnderlineExtension } from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Toggle } from "@/components/ui/toggle";

/**
 * A shadcn-styled rich text editor over Tiptap: the toolbar is built from
 * the same `Toggle`/`Button`/`Separator` primitives every other admin
 * surface uses, rather than a themed third-party toolbar, so it matches the
 * portal's own design tokens instead of carrying its own look.
 *
 * Controlled by an HTML string, the same shape a `<textarea>` would hand
 * back as plain text. The caller owns sanitizing that HTML before it is
 * stored or rendered elsewhere — this component only produces what Tiptap's
 * own schema allows, which is already a narrow, known set of tags.
 */
export function RichTextEditor({
  id,
  value,
  onChange,
  placeholder,
  disabled,
  className,
}: {
  id?: string;
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      UnderlineExtension,
      LinkExtension.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    editable: !disabled,
    immediatelyRender: false,
    onUpdate: ({ editor: instance }) => onChange(instance.getHTML()),
    editorProps: {
      attributes: {
        class: "rte-content",
        ...(id ? { id } : {}),
      },
    },
  });

  // The composer resets its content to "" after a successful save, which
  // means the value the editor renders no longer comes from the editor's
  // own `onUpdate` — it needs to be pushed back in. Comparing against the
  // editor's current HTML (rather than syncing unconditionally) is what
  // stops this from fighting the caret on every keystroke, since our own
  // `onUpdate` already made the two equal before this effect ever runs.
  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value || "", false);
    }
  }, [value, editor]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  if (!editor) {
    return (
      <div
        className={cn(
          "rte-shell flex min-h-[240px] items-center justify-center rounded-md border border-input",
          className,
        )}
      >
        <span className="text-muted-foreground text-sm">Loading editor…</span>
      </div>
    );
  }

  function openLinkPopover() {
    if (!editor) return;
    setLinkUrl(editor.getAttributes("link").href ?? "");
    setLinkOpen(true);
  }

  function applyLink() {
    if (!editor) return;
    const url = linkUrl.trim();
    if (url) {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    } else {
      editor.chain().focus().unsetLink().run();
    }
    setLinkOpen(false);
  }

  return (
    <div className={cn("rte-shell rounded-md border border-input", className)}>
      <div className="rte-toolbar flex flex-wrap items-center gap-0.5 border-b border-input p-1.5">
        <Toggle
          size="sm"
          pressed={editor.isActive("bold")}
          onPressedChange={() => editor.chain().focus().toggleBold().run()}
          disabled={disabled}
          aria-label="Bold"
        >
          <Bold />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("italic")}
          onPressedChange={() => editor.chain().focus().toggleItalic().run()}
          disabled={disabled}
          aria-label="Italic"
        >
          <Italic />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("underline")}
          onPressedChange={() => editor.chain().focus().toggleUnderline().run()}
          disabled={disabled}
          aria-label="Underline"
        >
          <UnderlineIcon />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("strike")}
          onPressedChange={() => editor.chain().focus().toggleStrike().run()}
          disabled={disabled}
          aria-label="Strikethrough"
        >
          <Strikethrough />
        </Toggle>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <Toggle
          size="sm"
          pressed={editor.isActive("heading", { level: 2 })}
          onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          disabled={disabled}
          aria-label="Heading 2"
        >
          <Heading2 />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("heading", { level: 3 })}
          onPressedChange={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          disabled={disabled}
          aria-label="Heading 3"
        >
          <Heading3 />
        </Toggle>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <Toggle
          size="sm"
          pressed={editor.isActive("bulletList")}
          onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
          disabled={disabled}
          aria-label="Bullet list"
        >
          <List />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("orderedList")}
          onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
          disabled={disabled}
          aria-label="Numbered list"
        >
          <ListOrdered />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("blockquote")}
          onPressedChange={() => editor.chain().focus().toggleBlockquote().run()}
          disabled={disabled}
          aria-label="Quote"
        >
          <Quote />
        </Toggle>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <Popover open={linkOpen} onOpenChange={setLinkOpen}>
          <PopoverTrigger asChild>
            <Toggle
              size="sm"
              pressed={editor.isActive("link")}
              onPressedChange={openLinkPopover}
              disabled={disabled}
              aria-label="Link"
            >
              <Link2 />
            </Toggle>
          </PopoverTrigger>
          <PopoverContent className="w-72" align="start">
            <div className="flex items-center gap-2">
              <Input
                autoFocus
                value={linkUrl}
                onChange={(event) => setLinkUrl(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applyLink();
                  }
                }}
                placeholder="https://…"
                className="h-9"
              />
              <Button type="button" size="sm" onClick={applyLink}>
                Apply
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        <Toggle
          size="sm"
          onPressedChange={() => editor.chain().focus().unsetLink().run()}
          disabled={disabled || !editor.isActive("link")}
          aria-label="Remove link"
        >
          <Link2Off />
        </Toggle>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <Toggle
          size="sm"
          onPressedChange={() => editor.chain().focus().undo().run()}
          disabled={disabled || !editor.can().undo()}
          aria-label="Undo"
        >
          <Undo2 />
        </Toggle>
        <Toggle
          size="sm"
          onPressedChange={() => editor.chain().focus().redo().run()}
          disabled={disabled || !editor.can().redo()}
          aria-label="Redo"
        >
          <Redo2 />
        </Toggle>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
