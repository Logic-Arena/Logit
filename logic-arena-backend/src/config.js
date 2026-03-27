import dotenv from 'dotenv';

dotenv.config();

export const MAX_PARTICIPANTS = 4;
export const PORT = process.env.PORT ?? 4000;
export const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173';

export const DB_HOST = process.env.DB_HOST ?? 'localhost';
export const DB_PORT = Number(process.env.DB_PORT ?? 5432);
export const DB_NAME = process.env.DB_NAME ?? 'logit_db';
export const DB_USER = process.env.DB_USER ?? 'postgres';
export const DB_PASSWORD = process.env.DB_PASSWORD ?? '';

export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? '';
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? '';
export const GOOGLE_CALLBACK_URL =
  process.env.GOOGLE_CALLBACK_URL ?? 'http://localhost:4000/auth/google/callback';

export const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY ?? '';
export const KAKAO_CLIENT_SECRET = process.env.KAKAO_CLIENT_SECRET ?? '';
export const KAKAO_CALLBACK_URL =
  process.env.KAKAO_CALLBACK_URL ?? 'http://localhost:4000/auth/kakao/callback';

export const JWT_SECRET = process.env.JWT_SECRET ?? 'dev_jwt_secret';
export const SESSION_SECRET = process.env.SESSION_SECRET ?? 'dev_session_secret';
export const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';