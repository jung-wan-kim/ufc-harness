export async function openNextChallenge(): Promise<{ id: string }> {
  // TODO: pick next challenge from curated pool OR generate via LLM,
  // enforce minimum diversity with recent challenges, persist to DB.
  return { id: 'placeholder' };
}
