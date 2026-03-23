'use client'
import { useRef } from 'react'
import { ConfirmDialog } from './confirm-dialog'
import { Button, type ButtonProps } from './button'

/**
 * Drop-in replacement for a destructive <Button type="submit"> inside a <form>.
 * Shows a confirm dialog before actually submitting the form.
 *
 * Usage:
 *   <form action={deleteItem}>
 *     <ConfirmSubmitButton title="Delete item?" description="This cannot be undone.">
 *       Delete
 *     </ConfirmSubmitButton>
 *   </form>
 */
interface ConfirmSubmitButtonProps extends Omit<ButtonProps, 'type'> {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
}

export function ConfirmSubmitButton({
  title,
  description,
  confirmLabel,
  cancelLabel,
  children,
  ...buttonProps
}: ConfirmSubmitButtonProps) {
  const hiddenRef = useRef<HTMLButtonElement>(null)

  return (
    <>
      {/* Real submit button — invisible, used by ConfirmDialog to trigger the form */}
      <button ref={hiddenRef} type="submit" className="hidden" aria-hidden tabIndex={-1} />
      <ConfirmDialog
        trigger={
          <Button type="button" {...buttonProps}>
            {children}
          </Button>
        }
        title={title}
        description={description}
        confirmLabel={confirmLabel ?? (typeof children === 'string' ? children : 'Confirm')}
        cancelLabel={cancelLabel}
        variant="destructive"
        onConfirm={() => hiddenRef.current?.click()}
      />
    </>
  )
}
