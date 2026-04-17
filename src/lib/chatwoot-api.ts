const getConfig = () => ({
  baseUrl: process.env.CHATWOOT_BASE_URL!,
  apiToken: process.env.CHATWOOT_API_TOKEN!,
  accountId: process.env.CHATWOOT_ACCOUNT_ID!,
});

async function chatwootFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { baseUrl, apiToken, accountId } = getConfig();
  const url = `${baseUrl}/api/v1/accounts/${accountId}${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      api_access_token: apiToken,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Chatwoot API ${res.status}: ${body}`);
  }

  return res.json();
}

interface ChatwootContact {
  id: number;
  name: string;
  identifier: string;
}

interface CreateContactResponse {
  payload: {
    contact: ChatwootContact;
  };
}

interface ChatwootConversation {
  id: number;
  inbox_id: number;
  contact_last_seen_at: string;
}

export async function createContact(
  name: string,
  identifier: string
): Promise<ChatwootContact> {
  const data = await chatwootFetch<CreateContactResponse>("/contacts", {
    method: "POST",
    body: JSON.stringify({ name, identifier }),
  });
  return data.payload.contact;
}

export async function createConversation(
  contactId: number,
  inboxId: number
): Promise<ChatwootConversation> {
  return chatwootFetch<ChatwootConversation>("/conversations", {
    method: "POST",
    body: JSON.stringify({
      contact_id: contactId,
      inbox_id: inboxId,
    }),
  });
}

export async function addLabel(
  conversationId: number,
  labels: string[]
): Promise<void> {
  await chatwootFetch(`/conversations/${conversationId}/labels`, {
    method: "POST",
    body: JSON.stringify({ labels }),
  });
}
