import OpenAI from "openai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { message, sender_id, receiver_ids } = req.body;

    if (!message || !sender_id || !receiver_ids) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Get current PKT (UTC+5)
    const nowUtc = new Date();
    const nowPkt = new Date(nowUtc.getTime() + 5 * 60 * 60 * 1000);
    const currentDate = nowPkt.toISOString().split("T")[0];
    const currentTime = nowPkt
      .toTimeString()
      .slice(0, 5); // HH:MM format

    const systemPrompt = `
You are a reminder extractor.
Your task is to analyze a user’s chat message and decide if it contains a time- or date-sensitive reminder.
Always respond ONLY in valid JSON with the following fields:

{
  "important": 0 or 1,
  "datetime": "YYYY-MM-DD HH:MM" or null,
  "message": "the original user message"
}

Rules:
- important = 1 if the message refers to a specific date/time, upcoming day, tomorrow, etc.
- If only a day (like Monday, tomorrow) is given and no exact time is given and its important then → set time as 09:00 AM.
- If urgent and today → set datetime = 1 hour after current time (${currentDate} ${currentTime}).
- important = 0 otherwise.
- datetime must be in Pakistan Standard Time (UTC+5).
- impotant =0 if date-time is previous or behind current date/time then its not important ,same for yesterday , or any previous date.  
- Today is ${currentDate}, and current time is ${currentTime}.
`;

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY, // use env variable on Vercel
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
      max_tokens: 100,
    });

    const content = completion.choices[0].message.content;
    const extracted = JSON.parse(content);

    // 📝 If you also want to write into Firestore here:
    // - Loop over receiver_ids
    // - Save { sender_id, receiver_id, ...extracted } into reminders collection

    return res.status(200).json({
      sender_id,
      receivers: receiver_ids,
      ...extracted,
    });
  } catch (error) {
    console.error("Reminder extraction error:", error);
    return res.status(500).json({
      error: error.message || "Failed to extract reminder",
    });
  }
}
