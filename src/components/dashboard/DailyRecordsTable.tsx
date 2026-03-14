
'use client';

import { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Edit2, Info, Star, Landmark, Moon, Coffee, Clock, CalendarClock } from "lucide-react";
import { calculateDetailedWork, calculateNightMinutes, minutesToTime, sortPontoHours, isDateDsr } from "@/lib/ponto-utils";
import { DailyRecord } from "@/app/page";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

function getExpectedEndTime(times: string[], dailyWorkload: number): string | null {
  if (times.length === 0 || times.length % 2 === 0) return null;

  const timeToMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const minutesToTimeStr = (m: number) => {
    const h = Math.floor(m / 60) % 24;
    const mins = m % 60;
    return `${String(h).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  };

  const entryTimes = times.filter((_, i) => i % 2 === 0 && i < times.length - 1);
  const exitTimes = times.filter((_, i) => i % 2 !== 0);
  
  const { total: workedSoFar } = calculateDetailedWork(entryTimes, exitTimes);
  
  const lastPunchStr = times[times.length - 1];
  let lastPunchMins = timeToMinutes(lastPunchStr);
  
  if (times.length > 1 && lastPunchMins < timeToMinutes(times[0])) {
    lastPunchMins += 1440;
  }

  let remaining = dailyWorkload - workedSoFar;
  
  if (times.length === 1) {
    // Assume 1 hora (60 min) de intervalo por padrão se só tem a entrada
    lastPunchMins += 60;
  }

  if (remaining <= 0) return null;

  let currentClock = lastPunchMins;
  let endClock = currentClock;
  
  while (true) {
    const rawMinutes = endClock - lastPunchMins;
    const nightMins = calculateNightMinutes(lastPunchMins, endClock);
    const nightBonus = Math.round(nightMins * ((60 / 52.3) - 1));
    const workForThisSegment = rawMinutes + nightBonus;
    
    if (workForThisSegment >= remaining) {
      break;
    }
    endClock++;
    
    // safety escape
    if (endClock - currentClock > 1440) break;
  }

  return minutesToTimeStr(endClock);
}

interface DailyRecordsTableProps {
  records: DailyRecord[];
  fixedDsrDays: number[];
  referenceDsrSunday?: string | null;
  dailyWorkload: number;
  holidays: string[];
  onEdit: (record: DailyRecord) => void;
}

export function DailyRecordsTable({ 
  records, 
  fixedDsrDays, 
  referenceDsrSunday, 
  dailyWorkload,
  holidays,
  onEdit 
}: DailyRecordsTableProps) {
  const [todayStr, setTodayStr] = useState<string>('');

  useEffect(() => {
    setTodayStr(new Date().toLocaleDateString('pt-BR'));
  }, []);

  return (
    <Card className="shadow-2xl border-border overflow-hidden bg-card">
      <CardHeader className="bg-muted/50 border-b border-border py-4">
        <CardTitle className="text-lg flex items-center justify-between font-black text-foreground">
          <div className="flex items-center gap-2">
            <span>DETALHAMENTO DE SALDO DIÁRIO</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-4 h-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs p-3 bg-slate-900 text-white border-none shadow-xl">
                  <p className="font-bold text-xs">Regra de Cálculo:</p>
                  <ul className="list-disc ml-4 mt-2 space-y-1 text-[11px] font-medium">
                    <li>Hora Extra = Trabalhado - Meta (ex: 07:20).</li>
                    <li>Em Folgas/DSR/Feriados sem batidas, o saldo é 0.</li>
                    <li>🌙 Indica bônus noturno já somado ao total.</li>
                    <li>Hoje: O saldo de hoje não conta no banco até amanhã (exceto se houver extra).</li>
                    <li>Futuro: Dias futuros não descontam horas da meta.</li>
                  </ul>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <span className="text-[10px] font-black text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20 uppercase">
            {records.length} Dias Exibidos
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-[140px] font-black text-foreground uppercase text-[11px] border-r">Data / Dia</TableHead>
              <TableHead className="font-black text-foreground uppercase text-[11px]">Tratamento / Batidas</TableHead>
              <TableHead className="text-right font-black text-foreground uppercase text-[11px]">Total Trabalhado</TableHead>
              <TableHead className="text-right font-black text-foreground uppercase text-[11px] border-l bg-primary/5">Saldo do Dia (+/-)</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length > 0 ? (
              records.map((record) => {
                const [day, month, year] = record.date.split('/').map(Number);
                const dateObj = new Date(year, month - 1, day);
                const isToday = record.date === todayStr;
                
                const todayRef = new Date();
                todayRef.setHours(0,0,0,0);
                const isFuture = dateObj > todayRef;

                const { isDsr: calendarDsr, isHoliday: calendarHoliday } = isDateDsr(dateObj, fixedDsrDays, referenceDsrSunday, holidays);
                
                const isManualFolga = record.isManualDsr || record.isBankOff || record.isCompensation;
                const isSystemHoliday = calendarHoliday || record.isHoliday;
                const isSystemDsr = calendarDsr;
                
                const isMetaZeroDay = (isManualFolga || isSystemHoliday || isSystemDsr) && !record.isManualWork;

                const sorted = sortPontoHours(record.times);
                const { total: workedMinutes, nightBonus } = calculateDetailedWork(
                  sorted.filter((_, i) => i % 2 === 0),
                  sorted.filter((_, i) => i % 2 !== 0)
                );
                
                const goalForDay = isMetaZeroDay ? 0 : dailyWorkload;
                
                // Saldo: 0 para futuro ou hoje (se ainda não bateu a meta)
                const isCalculated = workedMinutes > 0 || isMetaZeroDay;
                let dailyBalance = 0;
                if (isFuture) {
                  dailyBalance = 0;
                } else if (isToday && workedMinutes < goalForDay) {
                  dailyBalance = 0;
                } else {
                  dailyBalance = isCalculated ? workedMinutes - goalForDay : -dailyWorkload;
                }

                const isNoTime = !record.times || record.times.length === 0;

                return (
                  <TableRow key={record.id} className={cn(
                    "group hover:bg-accent/30 transition-colors border-border",
                    isToday && "bg-primary/5",
                    isFuture && "opacity-60"
                  )}>
                    <TableCell className="font-black text-foreground border-r py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{record.date}</span>
                        {isToday && <Badge variant="secondary" className="text-[8px] h-4 px-1 bg-primary text-primary-foreground font-black">HOJE</Badge>}
                        {record.isManual && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge variant="outline" className="text-[8px] h-4 px-1 border-amber-500 text-amber-600 bg-amber-500/5 font-black">MANUAL</Badge>
                              </TooltipTrigger>
                              <TooltipContent className="bg-amber-600 text-white border-none">
                                <p className="text-[10px] font-bold">Este dia possui ajustes manuais e não será sobrescrito pelo portal.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                      <div className={cn(
                        "text-[9px] font-black p-0.5 rounded inline-block uppercase",
                        isMetaZeroDay ? "text-green-700 bg-green-500/10 dark:text-green-400" : "text-primary bg-primary/10"
                      )}>
                        {dateObj.toLocaleDateString('pt-BR', { weekday: 'long' })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2 items-center">
                        {isFuture ? (
                          <Badge variant="outline" className="font-black px-3 py-1 uppercase text-[10px] flex items-center gap-2 border-slate-400/30 text-slate-500 bg-slate-500/5">
                            <CalendarClock className="w-3 h-3" /> Aguardando jornada...
                          </Badge>
                        ) : isNoTime ? (
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "font-black px-3 py-1 shadow-sm uppercase text-[10px] flex items-center gap-2",
                              isMetaZeroDay 
                                ? "border-green-600/30 text-green-700 bg-green-500/10 dark:text-green-400" 
                                : "border-red-600/30 text-red-700 bg-red-500/10 dark:text-red-400"
                            )}
                          >
                            {isSystemHoliday ? (
                              <><Star className="w-3 h-3 fill-current" /> Feriado</>
                            ) : record.isBankOff ? (
                              <><Landmark className="w-3 h-3" /> Folga Banco</>
                            ) : record.isCompensation ? (
                              <><Coffee className="w-3 h-3" /> Compensação</>
                            ) : isSystemDsr ? (
                              "DSR / Folga"
                            ) : isToday ? (
                              <><Clock className="w-3 h-3 animate-pulse" /> Em andamento...</>
                            ) : "Falta / Débito"}
                          </Badge>
                        ) : (
                          <>
                            {sorted.map((time, i) => (
                              <Badge 
                                key={i} 
                                className={cn(
                                  "font-black px-2 shadow-sm",
                                  i % 2 === 0 
                                    ? "bg-foreground text-background" 
                                    : "bg-background text-primary border-primary border"
                                )}
                              >
                                {time}
                              </Badge>
                            ))}
                            {isToday && sorted.length % 2 !== 0 && getExpectedEndTime(sorted, dailyWorkload) && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Badge variant="outline" className="font-black px-2 shadow-sm border-blue-500 text-blue-500 bg-blue-500/5 ml-1 animate-pulse">
                                      ~ {getExpectedEndTime(sorted, dailyWorkload)}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent className="bg-blue-600 text-white border-none">
                                    <p className="text-[10px] font-bold">Saída prevista (sugestão com base na carga horária).</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            {nightBonus > 0 && <Moon className="w-3.5 h-3.5 text-blue-500 ml-1" />}
                            {isSystemHoliday && <Star className="w-3 h-3 text-amber-500 fill-amber-500 ml-1" />}
                            {isSystemDsr && !isSystemHoliday && <Coffee className="w-3 h-3 text-green-500 ml-1" />}
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-black text-foreground text-base tabular-nums">
                      {isFuture ? "---" : (workedMinutes > 0 ? minutesToTime(workedMinutes) : (isToday && !isNoTime ? "Em curso" : "---"))}
                    </TableCell>
                    <TableCell className="text-right font-black text-base tabular-nums border-l bg-primary/5">
                      <span className={cn(
                        "px-2 py-0.5 rounded",
                        (isToday && dailyBalance <= 0) || isFuture ? "text-muted-foreground bg-muted" : (
                          dailyBalance >= 0 
                            ? "text-green-700 bg-green-500/10 dark:text-green-400" 
                            : "text-red-700 bg-red-500/10 dark:text-red-400"
                        )
                      )}>
                        {isFuture || (isToday && dailyBalance <= 0) ? "--:--" : minutesToTime(dailyBalance, true)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => onEdit(record)} 
                        className="h-8 w-8 text-muted-foreground hover:text-primary rounded-full"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground font-black uppercase text-xs">
                  Nenhum dado encontrado...
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
