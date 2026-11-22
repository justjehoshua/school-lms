import type { ReactNode } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Heading2, Heading3, Italic, List, ListOrdered, Quote, Redo2, Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils';

function Tool({ label, active, disabled, onClick, children }: { label: string; active?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} aria-pressed={active} disabled={disabled}
      onMouseDown={(e) => e.preventDefault()} onClick={onClick}
      className={cn('rounded p-1.5 text-slate-600 hover:bg-slate-200 disabled:opacity-40', active && 'bg-brand-100 text-brand-800')}>{children}</button>
  );
}

/** Mount with key={slide.id} so each slide gets a fresh editor. */
export function RichTextEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] } })],
    content: value,
    editorProps: { attributes: { class: 'slide-body min-h-[260px] rounded-b-lg border border-t-0 border-slate-300 bg-white p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500', 'aria-label': 'Slide content' } },
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? '' : e.getHTML()),
  });
  if (!editor) return null;
  const c = () => editor.chain().focus();
  return (
    <div>
      <div className="flex flex-wrap gap-0.5 rounded-t-lg border border-slate-300 bg-slate-50 p-1.5" role="toolbar" aria-label="Text formatting">
        <Tool label="Bold" active={editor.isActive('bold')} onClick={() => c().toggleBold().run()}><Bold className="h-4 w-4" /></Tool>
        <Tool label="Italic" active={editor.isActive('italic')} onClick={() => c().toggleItalic().run()}><Italic className="h-4 w-4" /></Tool>
        <Tool label="Heading" active={editor.isActive('heading', { level: 2 })} onClick={() => c().toggleHeading({ level: 2 }).run()}><Heading2 className="h-4 w-4" /></Tool>
        <Tool label="Subheading" active={editor.isActive('heading', { level: 3 })} onClick={() => c().toggleHeading({ level: 3 }).run()}><Heading3 className="h-4 w-4" /></Tool>
        <Tool label="Bulleted list" active={editor.isActive('bulletList')} onClick={() => c().toggleBulletList().run()}><List className="h-4 w-4" /></Tool>
        <Tool label="Numbered list" active={editor.isActive('orderedList')} onClick={() => c().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></Tool>
        <Tool label="Quote" active={editor.isActive('blockquote')} onClick={() => c().toggleBlockquote().run()}><Quote className="h-4 w-4" /></Tool>
        <span className="mx-1 w-px bg-slate-300" aria-hidden />
        <Tool label="Undo" disabled={!editor.can().undo()} onClick={() => c().undo().run()}><Undo2 className="h-4 w-4" /></Tool>
        <Tool label="Redo" disabled={!editor.can().redo()} onClick={() => c().redo().run()}><Redo2 className="h-4 w-4" /></Tool>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
