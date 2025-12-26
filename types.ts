
export interface User {
  id: string;
  username: string;
  password?: string; // Optional because we don't store it on client anymore
  avatar: string;
  color: string; // Avatar BG color
  nameColor?: string; // Text color for username
  credits: number; // Currency
  token?: string; // Session security token
}

export interface ReplyInfo {
  id: string;
  username: string;
  text: string;
}

export interface Message {
  id: string;
  userId: string;
  username: string;
  text: string;
  timestamp: number;
  isAi?: boolean;
  avatar?: string;
  userColor?: string; // Stored color at time of sending
  replyTo?: ReplyInfo;
}

export interface Notification {
  id: string;
  messageId: string;
  senderName: string;
  type: 'reply' | 'mention';
  text: string;
  timestamp: number;
  isRead: boolean;
}

export enum View {
  LOGIN,
  CHAT
}
