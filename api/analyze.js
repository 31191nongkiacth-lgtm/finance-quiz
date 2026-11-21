import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// เฉลยข้อ 3 - 14 เพื่อให้ AI ประเมินคะแนนได้แม่นยำ
const ANSWER_KEY = {
  q3: 'B', q4: 'B', q5: 'A', q6: 'B', q7: 'B', q8: 'C',
  q9: 'B', q10: 'B', q11: 'C', q12: 'B', q13: 'B', q14: 'B'
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { answers } = req.body || {};

    // ตรวจสอบความถูกต้องของข้อมูลและจำกัดความยาว
    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({ error: 'ข้อมูลคำตอบไม่ถูกต้อง' });
    }

    const serialized = JSON.stringify(answers);
    if (serialized.length > 2000) {
      return res.status(400).json({ error: 'ข้อมูลยาวเกินกำหนด' });
    }

    // ตรวจคะแนนข้อ 3-14
    let score = 0;
    const wrongQuestions = [];
    for (const [q, correctAns] of Object.entries(ANSWER_KEY)) {
      if (answers[q] === correctAns) {
        score++;
      } else {
        wrongQuestions.push(`${q.toUpperCase()} (ตอบ ${answers[q] || 'ไม่ตอบ'}, ที่ถูกคือ ${correctAns})`);
      }
    }

    const systemInstruction = `คุณคือ "โค้ชการเงินส่วนบุคคลที่เป็นมิตรและใจดี" สำหรับนักเรียนมัธยมปลาย
จงวิเคราะห์ผลการทำแบบทดสอบความรู้ทางการเงินและการออมของนักเรียนคนนี้ แล้วตอบกลับเป็นภาษาไทยที่อ่านง่าย เป็นกันเอง และให้กำลังใจ โดยมีโครงสร้างดังนี้เท่านั้น:
1. สรุปภาพรวม (บอกคะแนนที่ได้ ${score}/12 คะแนน และระดับความเข้าใจภาพรวม)
2. จุดแข็ง 3 ข้อ (อิงจากหัวข้อที่นักเรียนตอบถูก)
3. จุดที่ควรปรับปรุงหรือเรียนรู้เพิ่ม 3 ข้อ (อิงจากข้อที่ตอบผิด หรือต่อยอดความรู้ให้ลึกขึ้น)
4. แนวทางปฏิบัติ 5 ข้อที่ทำได้จริงในวัยเรียน
5. คำเตือนปิดท้ายว่า: "หมายเหตุ: ข้อมูลนี้เป็นคำแนะนำเบื้องต้นเพื่อการศึกษาเท่านั้น ไม่ใช่คำแนะนำทางการเงินจากผู้เชี่ยวชาญ"

เงื่อนไขสำคัญ: ความยาวทั้งหมดต้องไม่เกิน 400 คำ และห้ามขอหรือบันทึกข้อมูลส่วนตัวเพิ่มเติม`;

    const userPrompt = `ข้อมูลนักเรียน:
- ระดับชั้น: ${answers.q1 || 'ไม่ระบุ'}
- เพศ: ${answers.q2 || 'ไม่ระบุ'}
- คะแนนที่ได้: ${score} เต็ม 12 คะแนน
- ข้อที่ตอบผิด: ${wrongQuestions.length > 0 ? wrongQuestions.join(', ') : 'ไม่มี (ตอบถูกทุกข้อ)'}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: userPrompt,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      }
    });

    return res.status(200).json({ advice: response.text });
  } catch (error) {
    console.error('Gemini API Error:', error);
    return res.status(500).json({ error: 'ระบบ AI ขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง' });
  }
}
