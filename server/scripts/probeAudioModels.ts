import "dotenv/config";

async function run() {
    const models = ["openai/gpt-4o-mini-tts", "openai/gpt-4o-mini-audio-preview"];

    for (const modelId of models) {
        console.log(`--- Probing model: ${modelId} ---`);
        try {
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: modelId,
                    messages: [{ role: "user", content: "Say hello." }],
                    modalities: ["text", "audio"],
                    audio: { voice: "onyx", format: "mp3" },
                })
            });

            const data = await response.json();
            console.log(`Status for ${modelId}:`, response.status);
            if (data.error) {
                console.log(`Error for ${modelId}:`, data.error.message);
            } else {
                console.log(`Success for ${modelId}!`);
            }
        } catch (error: any) {
            console.error(`Probe for ${modelId} failed:`, error.message);
        }
    }
}

run().catch(console.error);
