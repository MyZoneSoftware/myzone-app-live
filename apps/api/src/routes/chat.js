import { Router } from 'express';
import { getOpenAI } from '../openai.js';
const router = Router();

router.post('/', async (req, res) => {
  try {
    const prompt = (req.body?.prompt || '').trim();
    if (!prompt) return res.status(400).json({ error: 'prompt is required' });

    const client = getOpenAI();
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'You are a helpful land planning assistant.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2
    });

    const answer = completion.choices?.[0]?.message?.content?.trim() || '';
    res.json({ answer });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
export default router;
