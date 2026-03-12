'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Plus, Coffee, Star, Landmark } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { DailyRecord } from '@/app/page';

interface EditTimesDialogProps {
  isOpen: boolean;
  record: DailyRecord;
  onSave: (times: string[], options: any) => void;
  onClose: () => void;
}

export function EditTimesDialog({ isOpen, record, onSave, onClose }: EditTimesDialogProps) {
  const [times, setTimes] = useState<string[]>([]);
  const [dayType, setDayType] = useState<string>('default');

  useEffect(() => {
    if (isOpen) {
      setTimes(record.times || []);
      if (record.isManualDsr) setDayType('folga');
      else if (record.isManualWork) setDayType('trabalho');
      else if (record.isHoliday) setDayType('feriado');
      else if (record.isCompensation) setDayType('compensacao');
      else if (record.isBankOff) setDayType('banco');
      else setDayType('default');
    }
  }, [record, isOpen]);

  const handleSave = () => {
    onSave(times, {
      isManualDsr: dayType === 'folga',
      isManualWork: dayType === 'trabalho',
      isHoliday: dayType === 'feriado',
      isCompensation: dayType === 'compensacao',
      isBankOff: dayType === 'banco'
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[450px] max-h-[90vh] overflow-y-auto bg-background border-border">
        <DialogHeader>
          <DialogTitle className="text-primary font-black uppercase tracking-tight">Ajuste Manual - {record.date}</DialogTitle>
          <DialogDescription className="font-bold">Defina o tratamento deste dia e seus horários.</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <section className="space-y-3">
            <Label className="text-xs font-black uppercase text-muted-foreground">Tratamento do Dia</Label>
            <RadioGroup value={dayType} onValueChange={setDayType} className="grid grid-cols-1 gap-2">
              <div className="flex items-center space-x-2 border p-3 rounded-lg hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="default" id="default" />
                <Label htmlFor="default" className="flex-1 cursor-pointer font-bold">Padrão do Sistema</Label>
              </div>
              <div className="flex items-center space-x-2 border p-3 rounded-lg hover:bg-accent/50 border-green-500/30">
                <RadioGroupItem value="folga" id="folga" />
                <Label htmlFor="folga" className="flex-1 cursor-pointer font-bold flex items-center justify-between">DSR / Folga Semanal <Coffee className="w-4 h-4 text-green-600" /></Label>
              </div>
              <div className="flex items-center space-x-2 border p-3 rounded-lg hover:bg-accent/50 border-blue-500/30">
                <RadioGroupItem value="feriado" id="feriado" />
                <Label htmlFor="feriado" className="flex-1 cursor-pointer font-bold flex items-center justify-between">Feriado <Star className="w-4 h-4 text-blue-600" /></Label>
              </div>
              <div className="flex items-center space-x-2 border p-3 rounded-lg hover:bg-accent/50 border-orange-500/30">
                <RadioGroupItem value="compensacao" id="compensacao" />
                <Label htmlFor="compensacao" className="flex-1 cursor-pointer font-bold flex items-center justify-between">Compensação Feriado <Landmark className="w-4 h-4 text-orange-600" /></Label>
              </div>
              <div className="flex items-center space-x-2 border p-3 rounded-lg hover:bg-accent/50 border-purple-500/30">
                <RadioGroupItem value="banco" id="banco" />
                <Label htmlFor="banco" className="flex-1 cursor-pointer font-bold">Folga Banco de Horas</Label>
              </div>
              <div className="flex items-center space-x-2 border p-3 rounded-lg hover:bg-accent/50 border-destructive/30">
                <RadioGroupItem value="trabalho" id="trabalho" />
                <Label htmlFor="trabalho" className="flex-1 cursor-pointer font-bold text-destructive">Forçar Dia Útil (Débito)</Label>
              </div>
            </RadioGroup>
          </section>

          <section className="space-y-3">
            <Label className="text-xs font-black uppercase text-muted-foreground">Horários de Batida</Label>
            <div className="grid gap-2">
              {times.map((time, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input type="time" value={time} onChange={(e) => {
                    const n = [...times]; n[idx] = e.target.value; setTimes(n);
                  }} className="font-mono font-bold bg-background" />
                  <Button variant="ghost" size="icon" onClick={() => setTimes(times.filter((_, i) => i !== idx))} className="text-destructive hover:bg-destructive/10"><Trash2 className="w-4 h-4" /></Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setTimes([...times, '08:00'])} className="w-full mt-2 border-dashed font-bold hover:bg-accent">Adicionar Horário</Button>
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="font-bold">Cancelar</Button>
          <Button onClick={handleSave} className="bg-primary font-bold shadow-lg">Salvar Alterações</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}