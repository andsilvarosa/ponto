
'use server';
/**
 * Server Action que realiza a consulta COMPLETA do mês no portal.
 * Implementa a lógica de navegação ASP.NET AJAX para percorrer todos os dias.
 */

/**
 * Extrai campos ocultos de um HTML completo ou de uma resposta Delta AJAX.
 */
function updateFields(html: string, currentFields: Record<string, string>): Record<string, string> {
  const fields = { ...currentFields };
  
  // Lógica para respostas AJAX Delta (|length|type|id|content|)
  if (html.includes('|')) {
    const parts = html.split('|');
    for (let i = 0; i < parts.length; i++) {
      const type = parts[i];
      const id = parts[i + 1];
      const content = parts[i + 2];
      
      if (type === 'hiddenField' && id) {
        fields[id] = content;
      }
      if (['__VIEWSTATE', '__EVENTVALIDATION', '__VIEWSTATEGENERATOR'].includes(id)) {
        fields[id] = content;
      }
    }
  }

  // Fallback para HTML completo
  const regex = /id="(__\w+)"\s+value="([^"]*)"/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    fields[match[1]] = match[2];
  }
  
  return fields;
}

function extractTimesFromGrid(html: string): string[] {
  const times: string[] = [];
  // Busca horários HH:MM dentro da tabela Grid
  const timeRegex = /<td>\s*([0-2]?\d:[0-5]\d)\s*<\/td>/g;
  let match;
  while ((match = timeRegex.exec(html)) !== null) {
    times.push(match[1]);
  }
  
  return Array.from(new Set(times)).map(t => {
      const parts = t.split(':');
      return `${parts[0].padStart(2, '0')}:${parts[1]}`;
  });
}

function extractCalendarArguments(html: string, targetMonth: number): Record<number, string> {
  const map: Record<number, string> = {};
  const linkRegex = /href="javascript:__doPostBack\('Calendar','(\d+)'\)"[^>]*?title="(\d+)\s+de\s+([^"]+)"/gi;
  let match;
  const monthNames = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const targetMonthName = monthNames[targetMonth - 1];

  while ((match = linkRegex.exec(html)) !== null) {
    const arg = match[1];
    const day = parseInt(match[2]);
    const monthStr = match[3].toLowerCase();
    
    if (monthStr.includes(targetMonthName)) {
      map[day] = arg;
    }
  }
  return map;
}

export async function fetchMonthData(matricula: string, month: number, year: number) {
  const results: { date: string, times: string[] }[] = [];
  const TARGET_URL = "https://webapp.confianca.com.br/consultaponto/ponto.aspx";

  try {
    const commonHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      'Origin': 'https://webapp.confianca.com.br',
      'Referer': TARGET_URL,
    };

    // 0. GET inicial para pegar VIEWSTATE e Cookies
    const responseGet = await fetch(TARGET_URL, {
      method: 'GET',
      headers: commonHeaders,
      cache: 'no-store'
    });
    
    if (!responseGet.ok) throw new Error(`Portal indisponível (Status ${responseGet.status})`);

    let html = await responseGet.text();
    let cookies = responseGet.headers.getSetCookie();
    let hiddenFields = updateFields(html, {});

    const calendarArgs = extractCalendarArguments(html, month);
    const daysToFetch = Object.keys(calendarArgs).map(Number).sort((a, b) => a - b);

    if (daysToFetch.length === 0) {
      throw new Error("Não foi possível localizar o calendário para o mês solicitado.");
    }

    const today = new Date();
    const isPastMonth = year < today.getFullYear() || (year === today.getFullYear() && month < (today.getMonth() + 1));
    const lastDayToFetch = isPastMonth ? 31 : today.getDate();

    // Loop por todos os dias do mês
    for (const day of daysToFetch) {
      if (day > lastDayToFetch) break;

      const dayArg = calendarArgs[day];
      
      // PASSO 1: Selecionar o dia
      const bodyDay = new URLSearchParams();
      Object.entries(hiddenFields).forEach(([k, v]) => bodyDay.append(k, v));
      bodyDay.set('__EVENTTARGET', 'Calendar');
      bodyDay.set('__EVENTARGUMENT', dayArg);
      bodyDay.set('txtMatricula', matricula);
      bodyDay.set('ScriptManager1', 'UpdatePanel1|Calendar');

      const respDay = await fetch(TARGET_URL, {
        method: 'POST',
        headers: { 
          ...commonHeaders,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': cookies.join('; '),
          'X-MicrosoftAjax': 'Delta=true',
        },
        body: bodyDay.toString()
      });
      
      const deltaHtmlDay = await respDay.text();
      hiddenFields = updateFields(deltaHtmlDay, hiddenFields);
      
      const newCookies = respDay.headers.getSetCookie();
      if (newCookies.length > 0) cookies = newCookies;

      // PASSO 2: Consultar horários
      const bodyConsultar = new URLSearchParams();
      Object.entries(hiddenFields).forEach(([k, v]) => bodyConsultar.append(k, v));
      bodyConsultar.set('__EVENTTARGET', 'btnConsultar');
      bodyConsultar.set('txtMatricula', matricula);
      bodyConsultar.set('ScriptManager1', 'UpdatePanel1|btnConsultar');

      const respFinal = await fetch(TARGET_URL, {
        method: 'POST',
        headers: { 
          ...commonHeaders,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': cookies.join('; '),
          'X-MicrosoftAjax': 'Delta=true',
        },
        body: bodyConsultar.toString()
      });
      
      const deltaHtmlFinal = await respFinal.text();
      const times = extractTimesFromGrid(deltaHtmlFinal);

      if (times.length > 0) {
        results.push({
          date: `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`,
          times
        });
      }
      
      hiddenFields = updateFields(deltaHtmlFinal, hiddenFields);
    }

    return { success: true, data: results };
  } catch (error: any) {
    console.error("Erro na extração:", error);
    return { success: false, error: error.message || "Falha de comunicação com o portal." };
  }
}
