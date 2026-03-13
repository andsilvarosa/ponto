'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Plus, Coffee, Star, Landmark, Clock } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { DailyRecord } from '@/app/page';
import { cn } from '@/lib/utils';

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
      isBankOff: dayType === 'banco',
      isManual: true // Sempre marca como manual ao salvar pelo diálogo
    });
  };

  const handleReset = () => {
    onSave(record.times || [], {
      isManualDsr: false,
      isManualWork: false,
      isHoliday: false,
      isCompensation: false,
      isBankOff: false,
      isManual: false // Remove a marca de manual para permitir sobrescrita pelo portal
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
              {[
                { id: 'default', label: 'Padrão do Sistema', icon: null, color: '' },
                { id: 'folga', label: 'DSR / Folga Semanal', icon: <Coffee className="w-4 h-4 text-green-600" />, color: 'border-green-500/30' },
                { id: 'feriado', label: 'Feriado', icon: <Star className="w-4 h-4 text-blue-600" />, color: 'border-blue-500/30' },
                { id: 'compensacao', label: 'Compensação Feriado', icon: <Landmark className="w-4 h-4 text-orange-600" />, color: 'border-orange-500/30' },
                { id: 'banco', label: 'Folga Banco de Horas', icon: <Landmark className="w-4 h-4 text-purple-600" />, color: 'border-purple-500/30' },
                { id: 'trabalho', label: 'Forçar Dia Útil (Débito)', icon: null, color: 'border-destructive/30', labelClass: 'text-destructive' },
              ].map((item) => (
                <div 
                  key={item.id}
                  onClick={() => setDayType(item.id)}
                  className={cn(
                    "flex items-center space-x-3 border p-3 rounded-xl cursor-pointer transition-all hover:bg-accent",
                    dayType === item.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-primary/50",
                    item.color
                  )}
                >
                  <RadioGroupItem value={item.id} id={item.id} />
                  <Label htmlFor={item.id} className={cn("flex-1 cursor-pointer font-bold flex items-center justify-between", item.labelClass)}>
                    {item.label}
                    {item.icon}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </section>

          <section className="space-y-3">
            <Label className="text-xs font-black uppercase text-muted-foreground">Horários de Batida</Label>
            <div className="grid gap-3">
              {times.map((time, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-muted/30 p-2 rounded-lg border border-border/50">
                  <div className="flex-1 flex items-center gap-2 bg-background rounded-md border px-3 py-1 focus-within:ring-2 focus-within:ring-primary transition-all">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <input 
                      type="time" 
                      value={time} 
                      onChange={(e) => {
                        const n = [...times]; n[idx] = e.target.value; setTimes(n);
                      }} 
                      className="flex-1 bg-transparent border-none focus:outline-none font-mono font-bold text-sm h-8" 
                    />
                  </div>
                  <Button 
                    type="button"
                    variant="ghost" 
                    size="icon" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setTimes(times.filter((_, i) => i !== idx));
                    }} 
                    className="text-destructive hover:bg-destructive/10 h-10 w-10 rounded-full"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button 
                type="button"
                variant="outline" 
                size="sm" 
                onClick={() => setTimes([...times, '08:00'])} 
                className="w-full mt-2 border-dashed font-black uppercase text-[10px] h-12 hover:bg-primary/5 hover:border-primary hover:text-primary transition-all rounded-xl"
              >
                <Plus className="w-3 h-3 mr-2" /> Adicionar Horário
              </Button>
            </div>
          </section>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleReset} className="font-bold border-destructive/30 text-destructive hover:bg-destructive/10">
            Restaurar Portal
          </Button>
          <div className="flex gap-2 ml-auto">
            <Button variant="ghost" onClick={onClose} className="font-bold">Cancelar</Button>
            <Button onClick={handleSave} className="bg-primary font-bold shadow-lg">Salvar Alterações</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}