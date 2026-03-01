import "dotenv/config";

async function run() {
    const modelId = "openai/gpt-4o-mini-tts-2025-12-15";
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
        console.log("Response Status:", response.status);
        console.log("Response Body:", JSON.stringify(data, null, 2));
    } catch (error: any) {
        console.error("Probe failed:", error.message);
    }
}

run().catch(console.error);
