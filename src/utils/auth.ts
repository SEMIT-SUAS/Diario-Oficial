// ====================================
// DOM - Authentication Utilities
// ====================================

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dom-secret-key-change-in-production';
const SALT_ROUNDS = 10;

export interface TokenPayload {
  userId: number;
  email: string;
  role: string;
  // Campos opcionais para preview
  editionId?: number;
  purpose?: string;
  iat?: number;
  exp?: number;
}

/**
 * Gera hash de senha usando bcrypt (RECOMENDADO para senhas)
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verifica se a senha corresponde ao hash bcrypt
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Gera token JWT usando jsonwebtoken
 */
export async function generateToken(payload: TokenPayload): Promise<string> {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

/**
 * Gera token JWT síncrono (para uso onde async não é ideal)
 */
export function signToken(payload: Partial<TokenPayload> & { userId: number }): string {
  // ✅ CORRIGIDO: Não duplicar userId
  const fullPayload: TokenPayload = {
    userId: payload.userId,
    email: payload.email || '',
    role: payload.role || 'publico',
    editionId: payload.editionId,
    purpose: payload.purpose,
    iat: payload.iat,
    exp: payload.exp
  };
  return jwt.sign(fullPayload, JWT_SECRET, { expiresIn: '24h' });
}

/**
 * Verifica e decodifica token JWT - Versão assíncrona
 */
export async function verifyTokenAsync(token: string): Promise<TokenPayload | null> {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return decoded;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

/**
 * Verifica token JWT - versão síncrona
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return decoded;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

/**
 * Gera um token temporário para preview (5 minutos)
 */
export function generatePreviewToken(userId: number, editionId: number): string {
  const payload = {
    userId,
    email: 'preview@dom.system',
    role: 'preview',
    editionId,
    purpose: 'preview',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (5 * 60) // 5 minutos
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '5m' });
}

/**
 * Gera hash SHA-256 para conteúdo geral (não para senhas)
 * Compatível com Node.js e browser
 */
export async function generateHash(content: string): Promise<string> {
  // Usar Node.js crypto se disponível
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }
  
  // Usar Web Crypto API para browser/Cloudflare
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  
  // Fallback para Node.js se crypto.subtle não estiver disponível
  try {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  } catch {
    throw new Error('Crypto API não disponível');
  }
}

/**
 * Gera hash de assinatura eletrônica para uma matéria
 */
export async function generateMatterSignature(
  matterId: number,
  userId: number,
  content: string,
  timestamp: string
): Promise<string> {
  const signatureData = `${matterId}|${userId}|${content}|${timestamp}`;
  return generateHash(signatureData);
}

/**
 * Verifica assinatura eletrônica de uma matéria
 */
export async function verifyMatterSignature(
  matterId: number,
  userId: number,
  content: string,
  timestamp: string,
  signature: string
): Promise<boolean> {
  const expectedSignature = await generateMatterSignature(matterId, userId, content, timestamp);
  return expectedSignature === signature;
}

/**
 * Gera hash SHA-256 para PDF
 */
export async function generatePdfHash(pdfContent: ArrayBuffer): Promise<string> {
  // Node.js
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(Buffer.from(pdfContent)).digest('hex');
  }
  
  // Browser/Cloudflare
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', pdfContent);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  
  throw new Error('Crypto API não disponível para gerar hash de PDF');
}

/**
 * Extrai token do header Authorization
 */
export function extractToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Gera um reset token para redefinição de senha
 */
export async function generateResetToken(userId: number): Promise<string> {
  const tokenData = `${userId}|${Date.now()}|${Math.random().toString(36).substring(2)}`;
  return generateHash(tokenData);
}

/**
 * Valida formato de email
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Valida força da senha
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (password.length < 6) {
    errors.push('A senha deve ter pelo menos 6 caracteres');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('A senha deve conter pelo menos uma letra maiúscula');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('A senha deve conter pelo menos um número');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}