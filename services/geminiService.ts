
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export async function getGeminiResponse(message: string, context: string) {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are a helpful and funny chat bot in a group chat. 
      Context of recent chat: ${context}
      User said: "${message}"
      Keep your response short (under 2 sentences), engaging, and friendly.`,
      config: {
        temperature: 0.8,
        topP: 0.95,
      },
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Hic, có chút lỗi kỹ thuật rồi bạn ơi! 😅";
  }
}
