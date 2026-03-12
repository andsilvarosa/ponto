
'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface PreviousBalanceDialogProps {
  isOpen: boolean;
  currentBalance?: string;
  currentMonth?: number;
  currentYear?: number;
  currentAdjustment?: string;
  currentHolidayBalance?: number;
  onSave: (balance: string, month: number, year: number, adjustment: string, holidayBalance: number) => void;
  onClose: () => void;
}

export function PreviousBalanceDialog({ 
  isOpen, 
  currentBalance = '00:00',
  currentMonth,
  currentYear,
  currentAdjustment = '00:00',
  currentHolidayBalance = 0, 
  onSave, 
  onClose 
}: PreviousBalanceDialogProps) {
  const [balance, setBalance] = useState('00:00');
  const [month, setMonth] = useState<string>('');
  const [year, setYear] = useState<string>('');
  const [adjustment, setAdjustment] = useState('00:00');
  const [holidayBalance, setHolidayBalance] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setBalance(currentBalance);
      setMonth(currentMonth?.toString() || new Date().getMonth().toString());
      setYear(currentYear?.toString() || new Date().getFullYear().toString());
      setAdjustment(currentAdjustment);
      setHolidayBalance(currentHolidayBalance);
    }
  }, [isOpen, currentBalance, currentMonth, currentYear, currentAdjustment, currentHolidayBalance]);

  const handleSave = () => {
    onSave(balance, parseInt(month), parseInt(year), adjustment, holidayBalance);
  };

  const months = [
    { label: 'Janeiro', value: '1' }, { label: 'Fevereiro', value: '2' },
    { label: 'Março', value: '3' }, { label: 'Abril', value: '4' },
    { label: 'Maio', value: '5' }, { label: 'Junho', value: '6' },
    { label: 'Julho', value: '7' }, { label: 'Agosto', value: '8' },
    { label: 'Setembro', value: '9' }, { label: 'Outubro', value: '10' },
    { label: 'Novembro', value: '11' }, { label: 'Dezembro', value: '12' },
  ];

  const currentYearVal = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => (currentYearVal - 5 + i).toString());

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[450px] bg-background border-border shadow-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-primary font-black text-2xl uppercase tracking-tighter">CONFIGURAÇÃO DE SALDO</DialogTitle>
          <DialogDescription className="font-bold text-muted-foreground">
            Defina o ponto de partida do seu banco de horas.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-black text-foreground uppercase text-[10px]">Mês de Início</Label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="font-bold"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="font-black text-foreground uppercase text-[10px]">Ano de Início</Label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="font-bold"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="balance" className="font-black text-foreground uppercase text-[10px]">
              Saldo Inicial (até o mês anterior)
            </Label>
            <Input
              id="balance"
              type="text"
              placeholder="HH:MM (ex: 10:30 ou -05:00)"
              className="focus-visible:ring-primary font-mono font-black text-lg border-border bg-muted/30 h-12"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="adjustment" className="font-black text-foreground uppercase text-[10px] text-amber-600">
              Ajuste de Saldo / RH (Diferenças de Segundos)
            </Label>
            <Input
              id="adjustment"
              type="text"
              placeholder="HH:MM (ex: 00:05 ou -00:02)"
              className="focus-visible:ring-primary font-mono font-black text-lg border-amber-600/30 bg-amber-600/5 h-12"
              value={adjustment}
              onChange={(e) => setAdjustment(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="holidayDays" className="font-black text-foreground uppercase text-[10px]">
              Saldo de Feriados Trabalhados (Dias)
            </Label>
            <Input
              id="holidayDays"
              type="number"
              placeholder="Dias acumulados"
              className="focus-visible:ring-primary font-black text-lg border-border bg-muted/30 h-12"
              value={holidayBalance}
              onChange={(e) => setHolidayBalance(parseInt(e.target.value) || 0)}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} className="font-black">CANCELAR</Button>
          <Button type="button" onClick={handleSave} className="bg-primary hover:bg-primary/90 text-primary-foreground font-black px-8 shadow-xl">
            SALVAR CONFIGURAÇÃO
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
