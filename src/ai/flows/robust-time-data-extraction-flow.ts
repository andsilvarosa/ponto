'use server';
/**
 * @fileOverview Fluxo Genkit para extração robusta de dados de ponto a partir de HTML.
 * Focado na estrutura exata da tabela "Grid" do portal ASP.NET.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const RobustTimeDataExtractionInputSchema = z.object({
  htmlContent: z.string().describe('O conteúdo HTML completo da página de consulta.'),
  matricula: z.string().describe('A matrícula do colaborador.'),
  month: z.number().int().min(1).max(12).describe('O mês da consulta.'),
  year: z.number().int().min(1900).max(2100).describe('O ano da consulta.'),
});
export type RobustTimeDataExtractionInput = z.infer<typeof RobustTimeDataExtractionInputSchema>;

const RobustTimeDataExtractionOutputSchema = z.object({
  matricula: z.string().describe('Matrícula confirmada.'),
  times: z.array(z.string()).describe('Lista plana de horários encontrados no formato HH:MM.'),
});
export type RobustTimeDataExtractionOutput = z.infer<typeof RobustTimeDataExtractionOutputSchema>;

const robustTimeDataExtractionPrompt = ai.definePrompt({
  name: 'robustTimeDataExtractionPrompt',
  model: 'googleai/gemini-1.5-flash',
  input: {schema: RobustTimeDataExtractionInputSchema},
  output: {schema: RobustTimeDataExtractionOutputSchema},
  prompt: `Você é um robô de extração de dados especializado em portais de RH.

Sua tarefa é extrair TODOS os horários de batida de ponto presentes no HTML fornecido.

PROCEDIMENTO:
1. Localize a tabela com o id="Grid".
2. Extraia cada valor de horário (HH:MM) presente nas células (td) dessa tabela.
3. Ignore o cabeçalho "Horário".
4. Retorne apenas a lista de horários encontrados, na ordem em que aparecem.

Exemplo de estrutura no HTML:
<table id="Grid">
  <tr><th>Horário</th></tr>
  <tr><td>08:00</td></tr>
  <tr><td>12:00</td></tr>
  <tr><td>13:00</td></tr>
  <tr><td>17:00</td></tr>
</table>

HTML PARA PROCESSAR:
{{{htmlContent}}}
`,
});

const robustTimeDataExtractionFlow = ai.defineFlow(
  {
    name: 'robustTimeDataExtractionFlow',
    inputSchema: RobustTimeDataExtractionInputSchema,
    outputSchema: RobustTimeDataExtractionOutputSchema,
  },
  async (input) => {
    try {
      const {output} = await robustTimeDataExtractionPrompt(input);
      if (!output) {
        throw new Error('A IA não retornou nenhum dado extraído.');
      }
      return output;
    } catch (error: any) {
      console.error("Erro na extração IA:", error);
      throw new Error(`Erro de extração (IA): ${error.message || 'Erro desconhecido'}`);
    }
  }
);

export async function robustTimeDataExtraction(input: RobustTimeDataExtractionInput): Promise<RobustTimeDataExtractionOutput> {
  return robustTimeDataExtractionFlow(input);
}
