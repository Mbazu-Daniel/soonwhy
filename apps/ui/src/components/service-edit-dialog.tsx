import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { api } from '~/lib/api';
import { SERVICE_FIELDS, serviceChanges, type EditableService } from '~/lib/service-fields';

export function ServiceEditDialog({ projectId, service }: { projectId: string; service: EditableService }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: () => api.patch(`/projects/${projectId}/services/${service.id}`, serviceChanges(service, values)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['service', projectId, service.id] });
      void queryClient.invalidateQueries({ queryKey: ['services', projectId] });
      setOpen(false);
    },
  });

  const show = () => {
    setValues(Object.fromEntries(SERVICE_FIELDS.map((field) => [field.key, service[field.key] ?? ''])));
    save.reset();
    setOpen(true);
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={show}><Pencil className="mr-2 h-3.5 w-3.5" />Edit details</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {service.name}</DialogTitle>
            <DialogDescription>Describe the runtime and where the code lives. Leave a field empty to clear it.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {SERVICE_FIELDS.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={`service-${field.key}`}>{field.label}</Label>
                <Input id={`service-${field.key}`} placeholder={field.placeholder} value={values[field.key] ?? ''} onChange={(event) => setValues({ ...values, [field.key]: event.target.value })} />
              </div>
            ))}
            {save.isError && <p className="text-sm text-[#8A1C13]">{save.error instanceof Error ? save.error.message : 'Could not save.'}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
