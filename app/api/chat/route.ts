
import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Cấu hình Headers cho CORS (Cho phép mọi nguồn truy cập)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// 1. Xử lý Preflight Request (Trình duyệt sẽ hỏi trước khi gửi POST)
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET() {
  try {
    // 1. Create table if not exists (Safe check)
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS messages (
          id VARCHAR(255) PRIMARY KEY,
          user_id VARCHAR(255),
          username VARCHAR(255),
          avatar TEXT,
          text TEXT,
          timestamp BIGINT,
          is_ai BOOLEAN,
          reply_to_id VARCHAR(255),
          reply_to_username VARCHAR(255),
          reply_to_text TEXT,
          user_color VARCHAR(50)
        );
      `;
    } catch (e) {
      console.error("Create Table Error:", e);
    }

    // 2. Migration: Ensure columns exist
    try {
        await Promise.all([
            sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id VARCHAR(255)`,
            sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_username VARCHAR(255)`,
            sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_text TEXT`,
            sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS user_color VARCHAR(50)`
        ]);
    } catch (e) {
      // Ignore if columns exist
    }

    // 3. Fetch messages
    const { rows } = await sql`SELECT * FROM messages ORDER BY timestamp ASC LIMIT 100`;
    
    // 4. Map fields carefully (Convert BigInt to Number, Map snake_case to camelCase)
    const formattedMessages = rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      username: row.username,
      avatar: row.avatar,
      text: row.text,
      timestamp: Number(row.timestamp),
      isAi: Boolean(row.is_ai),
      userColor: row.user_color,
      replyTo: row.reply_to_id ? {
        id: row.reply_to_id,
        username: row.reply_to_username,
        text: row.reply_to_text
      } : undefined
    }));

    // Thêm corsHeaders vào response
    return NextResponse.json({ messages: formattedMessages }, { headers: corsHeaders });
  } catch (error) {
    console.error('Database Error:', error);
    // Return empty array instead of crashing, nhưng vẫn phải có headers CORS
    return NextResponse.json({ messages: [], error: 'Database connection failed' }, { status: 500, headers: corsHeaders });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, userId, username, avatar, text, timestamp, isAi, replyTo, userColor } = body;

    if (!text || !username) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400, headers: corsHeaders });
    }

    // Prepare reply values
    const replyId = replyTo?.id || null;
    const replyUsername = replyTo?.username || null;
    const replyText = replyTo?.text || null;
    const color = userColor || null;

    // 1. Insert message with Reply info and Color
    await sql`
      INSERT INTO messages (id, user_id, username, avatar, text, timestamp, is_ai, reply_to_id, reply_to_username, reply_to_text, user_color)
      VALUES (${id}, ${userId}, ${username}, ${avatar}, ${text}, ${timestamp}, ${isAi || false}, ${replyId}, ${replyUsername}, ${replyText}, ${color})
    `;

    // 2. Cleanup old messages
    try {
        await sql`
        DELETE FROM messages
        WHERE id NOT IN (
            SELECT id
            FROM messages
            ORDER BY timestamp DESC
            LIMIT 1000
        )
        `;
    } catch (cleanupError) {
        console.error("Cleanup Error:", cleanupError);
    }

    // Thêm corsHeaders vào response thành công
    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    console.error('Database Error:', error);
    // Thêm corsHeaders vào response lỗi
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500, headers: corsHeaders });
  }
}
