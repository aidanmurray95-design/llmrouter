import type { VercelRequest, VercelResponse } from '@vercel/node';

interface ChatRequestBody {
  provider: 'claude' | 'openai';
  model: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body as ChatRequestBody;
    const { provider, model, messages, temperature = 0.7, maxTokens = 2000, stream = false } = body;

    if (!provider || !model || !messages) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (provider === 'claude') {
      return await handleClaude(res, model, messages, temperature, maxTokens, stream);
    } else if (provider === 'openai') {
      return await handleOpenAI(res, model, messages, temperature, maxTokens, stream);
    } else {
      return res.status(400).json({ error: 'Invalid provider' });
    }
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
}

async function handleClaude(
  res: VercelResponse,
  model: string,
  messages: any[],
  temperature: number,
  maxTokens: number,
  stream: boolean
) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Claude API key not configured' });
  }

  // Separate system messages
  const systemMessages = messages.filter(m => m.role === 'system');
  const conversationMessages = messages.filter(m => m.role !== 'system');

  const requestBody = {
    model,
    messages: conversationMessages.map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
    })),
    system: systemMessages.length > 0 ? systemMessages[0].content : undefined,
    temperature,
    max_tokens: maxTokens,
    stream,
  };

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
    return res.status(response.status).json({
      error: error.error?.message || 'Claude API request failed'
    });
  }

  if (stream) {
    // Set headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = response.body?.getReader();
    if (!reader) {
      return res.status(500).json({ error: 'Response body is not readable' });
    }

    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        res.write(chunk);
      }
      res.end();
    } catch (error) {
      console.error('Streaming error:', error);
      res.end();
    }
  } else {
    const data = await response.json();
    return res.status(200).json(data);
  }
}

async function handleOpenAI(
  res: VercelResponse,
  model: string,
  messages: any[],
  temperature: number,
  maxTokens: number,
  stream: boolean
) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'OpenAI API key not configured' });
  }

  const requestBody = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream,
  };

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
    return res.status(response.status).json({
      error: error.error?.message || 'OpenAI API request failed'
    });
  }

  if (stream) {
    // Set headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = response.body?.getReader();
    if (!reader) {
      return res.status(500).json({ error: 'Response body is not readable' });
    }

    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        res.write(chunk);
      }
      res.end();
    } catch (error) {
      console.error('Streaming error:', error);
      res.end();
    }
  } else {
    const data = await response.json();
    return res.status(200).json(data);
  }
}
