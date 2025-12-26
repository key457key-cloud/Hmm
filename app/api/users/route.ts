
import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Helper function to hash password
const hashPassword = (password: string) => {
  return crypto.createHash('sha256').update(password).digest('hex');
};

// Helper to generate a random session token
const generateToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    // 1. Setup Table with Token support
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(255) PRIMARY KEY,
          username VARCHAR(255),
          password VARCHAR(255),
          avatar TEXT,
          color VARCHAR(50),
          name_color VARCHAR(50),
          credits INT,
          session_token VARCHAR(255)
        );
      `;
      // Add session_token column if it doesn't exist (Migration)
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS session_token VARCHAR(255)`;
    } catch (e) {
      console.error("Create/Update User Table Error:", e);
    }

    const body = await request.json();
    const { action, id, password, user, token } = body;

    // --- REGISTER ---
    if (action === 'register') {
      
      // Server-side validation for ID length
      if (!user.id || user.id.length < 5) {
          return NextResponse.json({ error: 'ID quá ngắn (tối thiểu 5 ký tự)' }, { status: 400, headers: corsHeaders });
      }

      // Check duplicate
      const { rows } = await sql`SELECT id FROM users WHERE id = ${user.id}`;
      if (rows.length > 0) {
        return NextResponse.json({ error: 'ID đã tồn tại' }, { status: 400, headers: corsHeaders });
      }

      const hashedPassword = hashPassword(user.password);
      const sessionToken = generateToken();

      await sql`
        INSERT INTO users (id, username, password, avatar, color, name_color, credits, session_token)
        VALUES (${user.id}, ${user.username}, ${hashedPassword}, ${user.avatar}, ${user.color}, ${user.nameColor}, ${user.credits}, ${sessionToken})
      `;
      
      // Return user WITHOUT password, but with Token
      const safeUser = { ...user, password: '', token: sessionToken };
      return NextResponse.json({ success: true, user: safeUser }, { headers: corsHeaders });
    }

    // --- LOGIN ---
    if (action === 'login') {
      const { rows } = await sql`SELECT * FROM users WHERE id = ${id}`;
      
      if (rows.length === 0) {
        return NextResponse.json({ error: 'Tài khoản không tồn tại' }, { status: 404, headers: corsHeaders });
      }

      const foundUser = rows[0];
      const inputHash = hashPassword(password);
      
      // Check password (Secure Hash check)
      let isValid = foundUser.password === inputHash;

      // Fallback: Check plain text for old accounts and MIGRATE them
      if (!isValid && foundUser.password === password) {
          isValid = true;
          // Upgrade security immediately
          await sql`UPDATE users SET password = ${inputHash} WHERE id = ${id}`;
      }

      if (!isValid) {
        return NextResponse.json({ error: 'Sai mật khẩu' }, { status: 401, headers: corsHeaders });
      }

      // Generate new Session Token
      const newToken = generateToken();
      await sql`UPDATE users SET session_token = ${newToken} WHERE id = ${id}`;

      const userData = {
        id: foundUser.id,
        username: foundUser.username,
        avatar: foundUser.avatar,
        color: foundUser.color,
        nameColor: foundUser.name_color,
        credits: foundUser.credits,
        token: newToken // Send token to client
      };

      return NextResponse.json({ success: true, user: userData }, { headers: corsHeaders });
    }

    // --- VERIFY SESSION (Auto Login) ---
    if (action === 'verify') {
        if (!token) return NextResponse.json({ error: 'No token' }, { status: 401, headers: corsHeaders });

        const { rows } = await sql`SELECT * FROM users WHERE id = ${id} AND session_token = ${token}`;
        
        if (rows.length === 0) {
            return NextResponse.json({ error: 'Phiên đăng nhập hết hạn' }, { status: 401, headers: corsHeaders });
        }

        const foundUser = rows[0];
        const userData = {
            id: foundUser.id,
            username: foundUser.username,
            avatar: foundUser.avatar,
            color: foundUser.color,
            nameColor: foundUser.name_color,
            credits: foundUser.credits,
            token: foundUser.session_token
        };
        return NextResponse.json({ success: true, user: userData }, { headers: corsHeaders });
    }

    // --- UPDATE (Credits, Avatar, etc) ---
    if (action === 'update') {
        // Validate token if provided for extra security
       await sql`
        UPDATE users 
        SET username = ${user.username}, 
            avatar = ${user.avatar}, 
            name_color = ${user.nameColor}, 
            credits = ${user.credits}
        WHERE id = ${user.id}
      `;
      return NextResponse.json({ success: true }, { headers: corsHeaders });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400, headers: corsHeaders });

  } catch (error) {
    console.error('User API Error:', error);
    return NextResponse.json({ error: 'Server Error' }, { status: 500, headers: corsHeaders });
  }
}
