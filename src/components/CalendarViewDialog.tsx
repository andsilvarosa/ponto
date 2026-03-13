
'use client';

import { useMemo, useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DailyRecord } from '@/app/page';
import { isDateDsr, calculateDailyWorkedMinutes, minutesToTime, sortPontoHours } from '@/lib/ponto-utils';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Star } from 'lucide-react';

interface CalendarViewDialogProps {
  isOpen: boolean;
  records: DailyRecord[];
  fixedDsrDays: number[];
  referenceDsrSunday?: string | null;
  dailyWorkload: number;
  holidays: string[];
  onClose: () => void;
}

export function CalendarViewDialog({ 
  isOpen, 
  records, 
  fixedDsrDays, 
  referenceDsrSunday, 
  dailyWorkload,
  holidays,
  onClose 
}: CalendarViewDialogProps) {
  const [viewDate, setViewDate] = useState<Date | null>(null);

  // Inicializa a data apenas no cliente
  useEffect(() => {
    if (isOpen && viewDate === null) {
      setViewDate(new Date());
    }
  }, [isOpen]);

  const daysInMonth = useMemo(() => {
    if (!viewDate) return [];
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const days = [];
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d));
    }
    return days;
  }, [viewDate]);

  const recordMap = useMemo(() => {
    const map: Record<string, DailyRecord> = {};
    records.forEach(r => {
      map[r.date] = r;
    });
    return map;
  }, [records]);

  if (!viewDate) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto border-primary/20 shadow-2xl bg-background">
        <DialogHeader className="border-b pb-4">
          <div className="flex flex-col md:flex-row items-center justify-between w-full gap-4">
            <DialogTitle className="text-2xl font-black text-primary flex items-center gap-2">
              <CalendarIcon className="w-6 h-6" />
              PLANEJAMENTO ANUAL
            </DialogTitle>
            <div className="flex items-center gap-4 bg-muted p-1 rounded-lg border">
              <Button variant="ghost" size="icon" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} className="h-8 w-8">
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <span className="text-sm font-black min-w-[140px] text-center uppercase text-foreground">
                {viewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </span>
              <Button variant="ghost" size="icon" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} className="h-8 w-8">
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        <div className="grid grid-cols-7 gap-1 border border-border rounded-xl overflow-hidden bg-muted/20 p-1 mt-4 shadow-inner">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
            <div key={day} className="bg-muted p-2 text-center text-[10px] font-black uppercase text-muted-foreground">
              {day}
            </div>
          ))}
          
          {daysInMonth.map((date, idx) => {
            if (!date) return <div key={`empty-${idx}`} className="bg-transparent" />;
            
            const dateStr = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
            const record = recordMap[dateStr];
            
            const { isDsr: calendarDsr, isHoliday: calendarHoliday } = isDateDsr(date, fixedDsrDays, referenceDsrSunday, holidays);
            
            const isMetaZeroDay = calendarDsr || 
                                calendarHoliday || 
                                record?.isManualDsr || 
                                record?.isHoliday || 
                                record?.isBankOff || 
                                record?.isCompensation;

            let workedMinutes = 0;
            if (record) {
              const sorted = sortPontoHours(record.times);
              workedMinutes = calculateDailyWorkedMinutes(
                sorted.filter((_, i) => i % 2 === 0),
                sorted.filter((_, i) => i % 2 !== 0)
              );
            }

            let goalForDay = isMetaZeroDay ? 0 : dailyWorkload;
            
            // Lógica de saldo consistente com a tabela principal
            const todayLimit = new Date();
            todayLimit.setHours(0,0,0,0);
            const isFuture = date > todayLimit;
            const isToday = date.toDateString() === new Date().toDateString();

            let dailyBalance = 0;
            if (isFuture) {
              dailyBalance = 0;
            } else if (isToday && workedMinutes < goalForDay) {
              dailyBalance = 0;
            } else {
              dailyBalance = workedMinutes - goalForDay;
            }

            return (
              <div 
                key={dateStr} 
                className={cn(
                  "min-h-[110px] p-2 bg-card relative group transition-all border border-transparent hover:border-primary/40",
                  isMetaZeroDay && "bg-primary/5",
                  isToday && "ring-2 ring-primary ring-inset z-10"
                )}
              >
                <div className="flex justify-between items-start">
                  <span className={cn(
                    "text-xs font-black",
                    isMetaZeroDay ? "text-primary" : "text-foreground",
                    isToday && "bg-primary text-primary-foreground px-1.5 rounded-full"
                  )}>
                    {date.getDate()}
                  </span>
                  <div className="flex gap-1">
                    {record?.isManual && <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-sm" title="Ajuste Manual" />}
                    {(calendarHoliday || record?.isHoliday) && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}
                  </div>
                </div>
                
                <div className="mt-2 space-y-1">
                  {record && workedMinutes > 0 ? (
                    <>
                      <div className="text-[10px] font-black text-foreground tabular-nums text-center">
                        {minutesToTime(workedMinutes)}
                      </div>
                      <div className={cn(
                        "text-[10px] font-black p-0.5 rounded text-center tabular-nums shadow-sm border",
                        isFuture || (isToday && dailyBalance === 0)
                          ? "bg-muted text-muted-foreground border-border"
                          : dailyBalance >= 0 
                            ? "bg-green-500/10 text-green-600 border-green-500/20" 
                            : "bg-red-500/10 text-red-600 border-red-500/20"
                      )}>
                        {isFuture || (isToday && dailyBalance === 0) ? "--:--" : minutesToTime(dailyBalance, true)}
                      </div>
                    </>
                  ) : (
                    !isFuture && !isMetaZeroDay && (
                      <div className={cn(
                        "text-[9px] font-black p-0.5 rounded text-center border",
                        isToday 
                          ? "bg-muted text-muted-foreground border-border"
                          : "bg-destructive/10 text-destructive border-destructive/20"
                      )}>
                        {isToday ? "--:--" : `-${minutesToTime(dailyWorkload)}`}
                      </div>
                    )
                  )}
                  {isMetaZeroDay && !workedMinutes && (
                    <div className="text-[8px] font-black text-primary/70 text-center mt-1 uppercase">
                      {calendarHoliday ? "Feriado" : "Folga"}
                    </div>
                  )}
                  {isFuture && !workedMinutes && (
                    <div className="text-[8px] font-black text-muted-foreground/50 text-center mt-1 uppercase">
                      ---
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
