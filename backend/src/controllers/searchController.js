import dotenv from "dotenv";
dotenv.config(); // <-- ensures OPENAI_API_KEY is loaded before OpenAI client

import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const searchDistricts = async (req, res) => {
  const query = req.query.q;

  if (!query) {
    return res.status(400).json({ error: "Missing query parameter ?q=" });
  }

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a zoning expert that explains code in plain English." },
        { role: "user", content: `Explain the zoning district or regulation for: ${query}` }
      ],
    });

    const aiInsight = completion.choices?.[0]?.message?.content ?? "";

    res.json({
      query,
      aiInsight,
    });
  } catch (err) {
    console.error("OpenAI error:", err);
    res.status(500).json({
      error: "Search AI failed",
      details: err.message,
    });
  }
};
