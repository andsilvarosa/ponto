import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: 'AIzaSyDUna-oWX2OfEBZkJyIvmkHqgPPnTVWOA8'
    })
  ],
  model: 'googleai/gemini-1.5-flash',
});
