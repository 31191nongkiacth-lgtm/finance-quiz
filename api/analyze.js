import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// เฉลยข้อ 3 - 14 (12 คะแนน)
const ANSWER_KEY = {
  q3: 'B', q4: 'B', q5: 'A', q6: 'B', q7: 'B', q8: 'C',
  q9: 'B', q10: 'B', q11: 'C', q12: 'B', q13: 'B', q14: 'B'
};

const MODELS = ['gemini-2.5-flash', 'gemini-3.5-flash-lite'];
const ATTEMPT_TIMEOUT_MS = 12000; // จำกัดเวลาต่อรอบ 12 วินาที เพื่อไม่ให้เกิน Deadline

function callWithTimeout(promise, ms) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Timeout after ${ms}ms`));
    }, ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

async function generateWithFallback(userPrompt, systemInstruction) {
  let lastError;

  for (let i = 0; i < MODELS.length; i++) {
    const model = MODELS[i];
    try {
      const response = await callWithTimeout(
        ai.models.generateContent({
          model,
          contents: userPrompt,
          config: {
            systemInstruction,
            temperature: 0.6,
            maxOutputTokens: 900,
          },
        }),
        ATTEMPT_TIMEOUT_MS
      );

      if (response?.text) {
        return response.text;
      }
      throw new Error('Empty response text from Gemini');
    } catch (err) {
      lastError = err;
      console.error(`Gemini error (${model}, attempt ${i + 1}):`, err?.message || err);
    }
  }

  throw lastError;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { answers } = req.body || {};

    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({ error: 'ข้อมูลคำตอบไม่ถูกต้อง' });
    }

    const serialized = JSON.stringify(answers);
    if (serialized.length > 2000) {
      return res.status(400).json({ error: 'ข้อมูลยาวเกินกำหนด' });
    }

    let score = 0;
    const wrongQuestions = [];
    for (const [q, correctAns] of Object.entries(ANSWER_KEY)) {
      if (answers[q] === correctAns) {
        score++;
      } else {
        wrongQuestions.push(`${q.toUpperCase()} (ตอบ ${answers[q] || 'ไม่ตอบ'}, เฉลย ${correctAns})`);
      }
    }

    const systemInstruction = `คุณคือ "โค้ชการเงินส่วนบุคคลที่เป็นมิตรและใจดี" สำหรับนักเรียนมัธยมปลาย
วิเคราะห์ผลแบบทดสอบความรู้ทางการเงินและการออมเป็นภาษาไทย กระชับ อ่านง่าย ให้กำลังใจ โดยใช้โครงสร้างนี้เท่านั้น:
1. สรุปภาพรวม (ระบุคะแนน ${score}/12 คะแนน และระดับความเข้าใจ)
2. จุดแข็ง 3 ข้อ (อิงจากหัวข้อที่ตอบถูก)
3. จุดที่ควรเรียนรู้เพิ่ม 3 ข้อ (อิงจากข้อที่ตอบผิดหรือต่อยอดความรู้)
4. แนวทางปฏิบัติ 5 ข้อที่ทำได้จริงในวัยเรียน
5. ปิดท้ายด้วย: "หมายเหตุ: ข้อมูลนี้เป็นคำแนะนำเบื้องต้นเพื่อการศึกษาเท่านั้น ไม่ใช่คำแนะนำทางการเงินจากผู้เชี่ยวชาญ"

เงื่อนไข: ความยาวไม่เกิน 350 คำ และห้ามขอหรือบันทึกข้อมูลส่วนตัวเพิ่มเติม`;

    const userPrompt = `ข้อมูลนักเรียน:
- ระดับชั้น: ${answers.q1 || 'ไม่ระบุ'}
- เพศ: ${answers.q2 || 'ไม่ระบุ'}
- คะแนน: ${score}/12 คะแนน
- ข้อที่ผิด: ${wrongQuestions.length > 0 ? wrongQuestions.join(', ') : 'ไม่มี (ถูกทุกข้อ)'}`;

    const advice = await generateWithFallback(userPrompt, systemInstruction);
    return res.status(200).json({ advice });
  } catch (error) {
    console.error('Gemini API Error:', error);
    return res.status(500).json({ error: 'ระบบ AI ขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง' });
  }
}
