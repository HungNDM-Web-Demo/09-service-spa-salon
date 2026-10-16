'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { getErrorMessage, getFieldErrors } from '@/lib/api-error'
import type { ServiceGroupDto } from '@/types/spa'
import { useCreateGroup, useUpdateGroup } from '@/features/booking/hooks/use-spa'

/** `group` null là thêm mới */
export type GroupDialogTarget = { group: ServiceGroupDto | null }

/** Thêm, đổi tên nhóm dịch vụ (UC-01 1a). */
export function ServiceGroupFormDialog({
  target,
  onOpenChange,
}: {
  target: GroupDialogTarget | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {target && (
          <GroupForm
            key={target.group?.id ?? 'new'}
            group={target.group}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function GroupForm({ group, onClose }: { group: ServiceGroupDto | null; onClose: () => void }) {
  const create = useCreateGroup()
  const update = useUpdateGroup()
  const saving = create.isPending || update.isPending
  const [name, setName] = useState(group?.name ?? '')
  const [isVisible, setIsVisible] = useState(group?.isVisible ?? true)
  const [error, setError] = useState<string | undefined>()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Nhập tên nhóm')
      return
    }
    const input = { name: trimmed, isVisible }
    const onError = (err: unknown) => {
      const field = getFieldErrors(err).name
      if (field) setError(field)
      else toast.error(getErrorMessage(err))
    }
    const onSuccess = (saved: ServiceGroupDto) => {
      toast.success(group ? `Đã lưu nhóm ${saved.name}` : `Đã thêm nhóm ${saved.name}`)
      onClose()
    }
    if (group) update.mutate({ id: group.id, input }, { onSuccess, onError })
    else create.mutate(input, { onSuccess, onError })
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      <DialogHeader>
        <DialogTitle>{group ? `Đổi tên nhóm ${group.name}` : 'Thêm nhóm dịch vụ'}</DialogTitle>
        <DialogDescription>
          Nhóm gom dịch vụ trên hộp tạo lịch, trang đặt online và báo cáo.
        </DialogDescription>
      </DialogHeader>
      <FormField label="Tên nhóm" required error={error}>
        <Input
          autoComplete="off"
          autoFocus
          maxLength={100}
          value={name}
          placeholder="vd: Chăm sóc da"
          disabled={saving}
          onChange={(e) => {
            setName(e.target.value)
            setError(undefined)
          }}
        />
      </FormField>
      {!group && (
        <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
          <div className="space-y-0.5">
            <Label htmlFor="group-visible" className="cursor-pointer">
              Hiện nhóm ngay
            </Label>
            <p className="text-muted-foreground text-xs">
              Tắt nếu chưa muốn nhóm hiện trên hộp tạo lịch, trang đặt online.
            </p>
          </div>
          <Switch
            id="group-visible"
            checked={isVisible}
            disabled={saving}
            onCheckedChange={setIsVisible}
          />
        </div>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
          Hủy
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
          {group ? 'Lưu tên nhóm' : 'Thêm nhóm'}
        </Button>
      </DialogFooter>
    </form>
  )
}
