
import 'server-only';
import OpenAI from 'openai';

// User-selected model; default to a higher-quality option
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'z-ai/glm-4.7';

let openai: OpenAI | null = null;

function getClient(): OpenAI {
  if (openai) return openai;

  const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not set. Please configure it in your .env file.');
  }

  openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey,
    // OpenRouter specific headers
    defaultHeaders: {
      'HTTP-Referer': 'https://reponexus.dev', 
      'X-Title': 'RepoNexus',
    },
  });

  return openai;
}

export async function analyzeText(prompt: string, systemPrompt?: string): Promise<string> {
  try {
    const client = getClient();
    const completion = await client.chat.completions.create({
      model: OPENROUTER_MODEL,
      messages: [
        { role: 'system', content: systemPrompt || 'You are a helpful assistant.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2, 
    });

    return completion.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('LLM Analysis Failed:', error);
    throw new Error('Failed to generate analysis from OpenRouter');
  }
}

export async function analyzeJSON<T>(prompt: string, systemPrompt?: string): Promise<T> {
  try {
    const client = getClient();
    const completion = await client.chat.completions.create({
      model: OPENROUTER_MODEL,
      messages: [
        { 
          role: 'system', 
          content: (systemPrompt || 'You are a helpful assistant.') + ' Respond strictly with valid JSON.' 
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    const content = completion.choices[0]?.message?.content || '{}';
    return JSON.parse(content) as T;
  } catch (error) {
    console.error('LLM JSON Analysis Failed:', error);
    throw new Error('Failed to generate JSON analysis from OpenRouter');
  }
}
