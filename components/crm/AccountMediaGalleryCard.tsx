import Link from 'next/link'
import { FileSpreadsheet, FileText, ImageIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate } from '@/lib/utils'

export type AccountMediaItem = {
  id: string
  url: string
  thumbnailUrl: string
  mediaType: string
  label: string
  sourceType: string
  sourceLabel: string
  caption: string | null
  createdAt: Date
  relatedHref: string | null
}

function isImageMedia(mediaType: string) {
  return mediaType === 'image'
}

function getDocumentMeta(mediaType: string) {
  if (mediaType === 'spreadsheet') return { icon: FileSpreadsheet, badge: 'Spreadsheet' }
  if (mediaType === 'presentation') return { icon: FileText, badge: 'Presentation' }
  if (mediaType === 'word') return { icon: FileText, badge: 'Word document' }
  if (mediaType === 'pdf') return { icon: FileText, badge: 'PDF' }
  return { icon: FileText, badge: 'Document' }
}

export function AccountMediaGalleryCard({
  items,
  title = 'Media',
  href,
}: {
  items: AccountMediaItem[]
  title?: string
  href?: string
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4" />
          {title}
        </CardTitle>
        {href ? <Link href={href} className="text-xs font-medium text-blue-600 hover:underline">View full tab</Link> : null}
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">No media uploaded for this account yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => {
              const imageMedia = isImageMedia(item.mediaType)
              const documentMeta = imageMedia ? null : getDocumentMeta(item.mediaType)
              const body = (
                <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition hover:border-slate-200">
                  <div className="aspect-[4/3] bg-slate-100">
                    {imageMedia ? (
                      <img src={item.thumbnailUrl} alt={item.label} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
                        {documentMeta ? <documentMeta.icon className="h-10 w-10 text-slate-500" /> : null}
                        <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                          {documentMeta?.badge ?? 'Document'}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1 px-3 py-3">
                    <p className="text-sm font-medium text-slate-900">{item.label}</p>
                    <p className="text-xs text-slate-500">{item.sourceLabel}</p>
                    <p className="text-[11px] uppercase tracking-wide text-slate-400" suppressHydrationWarning>
                      {formatDate(item.createdAt)}
                    </p>
                    {item.caption ? <p className="line-clamp-2 text-xs text-slate-600">{item.caption}</p> : null}
                  </div>
                </div>
              )

              return item.relatedHref ? (
                <Link key={item.id} href={item.relatedHref}>
                  {body}
                </Link>
              ) : (
                <a key={item.id} href={item.url} target="_blank" rel="noreferrer">
                  {body}
                </a>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
