'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Info, Calendar, Plus, Trash2 } from 'lucide-react';

interface DsrSettingsDialogProps {
  isOpen: boolean;
  fixedDsrDays: number[];
  referenceSunday: string | null;
  dailyWorkload: number;
  holidays: string[];
  onSave: (days: number[], referenceSunday: string | null, workload: number, holidays: string[]) => void;
  onClose: () => void;
}

const DAYS_OF_WEEK = [
  { label: 'Dom', value: 0 }, { label: 'Seg', value: 1 }, { label: 'Ter', value: 2 },
  { label: 'Qua', value: 3 }, { label: 'Qui', value: 4 }, { label: 'Sex', value: 5 }, { label: 'Sáb', value: 6 },
];

export function DsrSettingsDialog({ isOpen, fixedDsrDays, referenceSunday, dailyWorkload, holidays, onSave, onClose }: DsrSettingsDialogProps) {
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [refSunday, setRefSunday] = useState<string>('');
  const [workload, setWorkload] = useState<number>(440);
  const [hdays, setHdays] = useState<string[]>([]);
  const [newHday, setNewHday] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSelectedDays(fixedDsrDays || []);
      setRefSunday(referenceSunday || '');
      setWorkload(dailyWorkload || 440);
      setHdays(holidays || []);
    }
  }, [isOpen, fixedDsrDays, referenceSunday, dailyWorkload, holidays]);

  const toggleDay = (day: number) => {
    setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const addHoliday = () => {
    if (newHday && !hdays.includes(newHday)) {
      setHdays([...hdays, newHday]);
      setNewHday('');
    }
  };

  const removeHoliday = (date: string) => {
    setHdays(hdays.filter(h => h !== date));
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto bg-background border-border">
        <DialogHeader>
          <DialogTitle className="text-primary font-black uppercase tracking-tight">Configurações de Jornada</DialogTitle>
          <DialogDescription className="font-medium">Ajuste sua escala, carga horária e feriados.</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-2">
          <section className="space-y-3">
            <Label className="text-sm font-black uppercase text-muted-foreground">Carga Horária Diária</Label>
            <RadioGroup value={workload.toString()} onValueChange={(v) => setWorkload(parseInt(v))} className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2 border p-3 rounded-lg bg-muted/50">
                <RadioGroupItem value="440" id="h720" />
                <Label htmlFor="h720" className="cursor-pointer font-bold">7h20 (Escala 6x1)</Label>
              </div>
              <div className="flex items-center space-x-2 border p-3 rounded-lg bg-muted/50">
                <RadioGroupItem value="528" id="h848" />
                <Label htmlFor="h848" className="cursor-pointer font-bold">8h48 (Escala 5x2)</Label>
              </div>
            </RadioGroup>
          </section>

          <section className="space-y-3">
            <Label className="text-sm font-black uppercase text-muted-foreground">Folgas Fixas Semanais</Label>
            <div className="grid grid-cols-4 gap-2 bg-muted/50 p-3 rounded-lg border">
              {DAYS_OF_WEEK.map((day) => (
                <div key={day.value} className="flex items-center space-x-2">
                  <Checkbox id={`day-${day.value}`} checked={selectedDays.includes(day.value)} onCheckedChange={() => toggleDay(day.value)} />
                  <Label htmlFor={`day-${day.value}`} className="text-xs cursor-pointer font-bold">{day.label}</Label>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <Label className="text-sm font-black uppercase text-muted-foreground">Feriados do Ano</Label>
            <div className="flex gap-2">
              <Input type="date" value={newHday} onChange={(e) => setNewHday(e.target.value)} className="bg-background border-border" />
              <Button size="icon" onClick={addHoliday} variant="secondary"><Plus className="w-4 h-4" /></Button>
            </div>
            <div className="flex flex-wrap gap-2 max-h-[100px] overflow-y-auto p-1">
              {hdays.sort().map(h => (
                <div key={h} className="bg-muted px-2 py-1 rounded text-[10px] font-black flex items-center gap-2 border">
                  {h.split('-').reverse().join('/')}
                  <Trash2 className="w-3 h-3 text-destructive cursor-pointer" onClick={() => removeHoliday(h)} />
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <Label className="text-sm font-black uppercase text-muted-foreground">Domingo de Referência (Escala 1x2)</Label>
            <div className="bg-primary/5 p-4 rounded-lg border border-primary/10">
              <p className="text-[11px] text-muted-foreground font-medium mb-2">Informe um domingo em que você <b>FOLGOU</b> para projetar a escala.</p>
              <Input type="date" value={refSunday} onChange={(e) => setRefSunday(e.target.value)} className="bg-background" />
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="font-bold">Cancelar</Button>
          <Button onClick={() => onSave(selectedDays, refSunday || null, workload, hdays)} className="bg-primary font-bold shadow-lg">Salvar Configurações</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
