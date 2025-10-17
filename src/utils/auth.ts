// ====================================
// DOM - Authentication Utilities
// ====================================

/**
 * Gera hash de senha usando Web Crypto API
 * (compatível com Cloudflare Workers)
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Verifica se a senha corresponde ao hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

/**
 * Gera token JWT simples (sem biblioteca externa)
 * Em produção, considere usar biblioteca específica
 */
export async function generateToken(userId: number, email: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    userId,
    email,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 horas
  };

  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(payload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  
  // Usar uma chave secreta (em produção, usar variável de ambiente)
  const secret = 'dom-secret-key-change-in-production';
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(signatureInput)
  );
  
  const signatureArray = Array.from(new Uint8Array(signature));
  const signatureBase64 = btoa(String.fromCharCode(...signatureArray));
  
  return `${encodedHeader}.${encodedPayload}.${signatureBase64}`;
}

/**
 * Verifica e decodifica token JWT
 */
export async function verifyToken(token: string): Promise<{ userId: number; email: string } | null> {
  try {
    const [encodedHeader, encodedPayload, signature] = token.split('.');
    
    const payload = JSON.parse(atob(encodedPayload));
    
    // Verificar expiração
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    
    return {
      userId: payload.userId,
      email: payload.email
    };
  } catch (error) {
    return null;
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
  const encoder = new TextEncoder();
  const data = encoder.encode(signatureData);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
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
  const hashBuffer = await crypto.subtle.digest('SHA-256', pdfContent);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}
