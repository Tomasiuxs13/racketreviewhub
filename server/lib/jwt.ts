import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production";
const JWT_EXPIRES_IN = "7d"; // Token expires in 7 days

export interface JwtPayload {
  userId: string;
  email: string;
  isAdmin: boolean;
}

// Admin credentials from environment variables
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

// Admin password hash - generate this using: bcrypt.hashSync("your-password", 10)
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || "";

/**
 * Generate a JWT token for a user
 */
export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Compare a password with a hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Validate admin credentials
 * Returns user info if valid, null otherwise
 */
export async function validateAdminCredentials(
  email: string,
  password: string
): Promise<JwtPayload | null> {
  const normalizedEmail = email.toLowerCase().trim();
  
  // Check if email is in admin list
  if (!ADMIN_EMAILS.includes(normalizedEmail)) {
    return null;
  }
  
  // Check password
  if (!ADMIN_PASSWORD_HASH) {
    console.error("ADMIN_PASSWORD_HASH environment variable not set");
    return null;
  }
  
  const isValidPassword = await comparePassword(password, ADMIN_PASSWORD_HASH);
  if (!isValidPassword) {
    return null;
  }
  
  return {
    userId: `admin-${normalizedEmail}`,
    email: normalizedEmail,
    isAdmin: true,
  };
}

/**
 * Check if an email is in the admin list
 */
export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.includes(email.toLowerCase().trim());
}

/**
 * Utility to generate a password hash (for setup purposes)
 * Run: npx tsx -e "import { hashPassword } from './server/lib/jwt'; hashPassword('your-password').then(console.log)"
 */
export async function generatePasswordHash(password: string): Promise<string> {
  const hash = await hashPassword(password);
  console.log("Generated password hash:", hash);
  return hash;
}


