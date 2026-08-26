export interface BotBrainCandidate {
  id: string;
  name: string;
}

export interface BotBrainChatEntry {
  name: string;
  text: string;
}

export interface BotBrainRequest {
  botName: string;
  botRole: string;
  chatHistory: BotBrainChatEntry[];
  candidates: BotBrainCandidate[];
  task: 'chat' | 'vote';
}

export interface BotBrainResponse {
  chatMessage: string;
  voteTarget: string | null;
}

const BOT_BRAIN_TIMEOUT_MS = 4_500;

export async function askBotBrain(input: BotBrainRequest): Promise<BotBrainResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BOT_BRAIN_TIMEOUT_MS);

  try {
    const response = await fetch('/api/bot-brain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Bot brain returned ${response.status}`);

    const data = (await response.json()) as Partial<BotBrainResponse>;
    if (typeof data.chatMessage !== 'string') throw new Error('Invalid bot chat response');
    if (data.voteTarget !== null && typeof data.voteTarget !== 'string') {
      throw new Error('Invalid bot vote response');
    }

    return {
      chatMessage: data.chatMessage.trim(),
      voteTarget: data.voteTarget?.trim() || null,
    };
  } finally {
    clearTimeout(timer);
  }
}
