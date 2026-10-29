export function ttsConfigured() {
  return Boolean(process.env.GOOGLE_TTS_API_KEY);
}

export async function synthesizeSpeech(text: string): Promise<string> {
  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_TTS_API_KEY is not set");
  }

  const response = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text: text.slice(0, 900) },
        voice: { languageCode: "en-US", name: "en-US-Chirp3-HD-Aoede" },
        audioConfig: { audioEncoding: "MP3", speakingRate: 1.02 },
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Speech request failed with ${response.status}: ${body.slice(0, 300)}`);
  }

  const data = (await response.json()) as { audioContent?: string };
  if (!data.audioContent) {
    throw new Error("Speech service returned no audio");
  }
  return data.audioContent;
}
