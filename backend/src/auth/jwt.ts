import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createPublicClient, http, Address } from 'viem';

interface JWTPayload {
  userId: string;
  wallet: string;
  role: string;
  iat: number;
  exp: number;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    wallet: string;
    role: string;
  };
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_ALGORITHM = process.env.JWT_ALGORITHM || 'HS256';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';

/**
 * Generate a JWT token for a user
 */
export function generateToken(userId: string, wallet: string, role: string = 'USER'): string {
  return jwt.sign(
    { userId, wallet, role },
    JWT_SECRET,
    { algorithm: JWT_ALGORITHM as jwt.Algorithm, expiresIn: JWT_EXPIRY }
  );
}

/**
 * Verify a JWT token and return the payload
 */
export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM as jwt.Algorithm] }) as JWTPayload;
}

/**
 * Express middleware to authenticate JWT tokens
 * Accepts: Bearer <token> header or x-access-token header
 */
export function authenticateJWT(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    const tokenFromHeader = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const token = tokenFromHeader || (req.headers['x-access-token'] as string);

    if (!token) {
      res.status(401).json({ error: 'Access token required' });
      return;
    }

    const payload = verifyToken(token);
    
    // Check token expiration explicitly
    if (payload.exp * 1000 < Date.now()) {
      res.status(401).json({ error: 'Token expired' });
      return;
    }

    req.user = {
      userId: payload.userId,
      wallet: payload.wallet,
      role: payload.role,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token expired' });
      return;
    }
    res.status(500).json({ error: 'Authentication failed' });
  }
}

/**
 * Express middleware to require specific role
 * Usage: requireRole('ADMIN') — must be ADMIN or higher
 */
export function requireRole(minRole: string) {
  const ROLE_HIERARCHY: Record<string, number> = {
    USER: 0,
    MODERATOR: 1,
    ADMIN: 2,
    SUPER_ADMIN: 3,
  };

  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const userRoleLevel = ROLE_HIERARCHY[req.user.role] ?? 0;
    const requiredLevel = ROLE_HIERARCHY[minRole] ?? 0;

    if (userRoleLevel < requiredLevel) {
      res.status(403).json({ error: 'Insufficient permissions', required: minRole, current: req.user.role });
      return;
    }

    next();
  };
}

/**
 * WebSocket JWT authentication
 * Usage: io.use(authenticateSocketJWT)
 */
export function authenticateSocketJWT(socket: any, next: (err?: Error) => void): void {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.['x-access-token'];
    
    if (!token) {
      return next(new Error('Authentication required'));
    }

    const payload = verifyToken(token);
    socket.user = {
      userId: payload.userId,
      wallet: payload.wallet,
      role: payload.role,
    };
    next();
  } catch (error) {
    next(new Error('Invalid token'));
  }
}

/**
 * Generate a nonce for wallet signature verification
 */
export function generateNonce(): string {
  return `Sign this message to authenticate with CryptoFlip: ${Date.now()}-${Math.random().toString(36).substring(2)}`;
}

/**
 * Verify a wallet signature (EIP-191 personal sign)
 * Returns the recovered wallet address
 */
export async function verifyWalletSignature(message: string, signature: `0x${string}`, expectedWallet: string): Promise<boolean> {
  try {
    const { createPublicClient, http, recoverMessageAddress } = await import('viem');
    
    const recoveredAddress = await recoverMessageAddress({
      message,
      signature,
    });
    
    return recoveredAddress.toLowerCase() === expectedWallet.toLowerCase();
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
}

/**
 * Refresh token endpoint helper
 * Issues new token with extended expiry
 */
export function refreshToken(oldToken: string): { token: string; expiresAt: number } | null {
  try {
    const payload = verifyToken(oldToken);
    const newToken = generateToken(payload.userId, payload.wallet, payload.role);
    const decoded = jwt.decode(newToken) as JWTPayload;
    return { token: newToken, expiresAt: decoded.exp * 1000 };
  } catch {
    return null;
  }
}
