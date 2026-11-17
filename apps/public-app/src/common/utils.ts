import * as jwt from "jsonwebtoken";
import { SignOptions } from "jsonwebtoken";

/** How long an email verification code stays valid. */
const VERIFICATION_CODE_TTL_SECONDS = 300;

export const createToken = async (
  payload: object,
  expiresIn: SignOptions["expiresIn"] = "1d"
): Promise<string> => {
  const secret = process.env["JWT_SECRET"];
  if (!secret) throw new Error("JWT_SECRET not set");

  return jwt.sign(payload, secret, { expiresIn });
};

export const decodeToken = async (token: string): Promise<any> => {
  const secret = process.env["JWT_SECRET"];
  if (!secret) throw new Error("JWT_SECRET not set");

  return jwt.verify(token, secret);
};

/** A random 6-digit code. */
export const createVerificationCode = (): number => {
  return Math.floor(100000 + Math.random() * 900000);
};

export const generateVerificationPayload = (): { verificationCode: number; verificationExpiresAt: number } => {
  return {
    verificationCode: createVerificationCode(),
    verificationExpiresAt: Math.floor(Date.now() / 1000) + VERIFICATION_CODE_TTL_SECONDS,
  };
};

/** "https://github.com/owner/repo.git" -> "owner/repo" */
export const extractRepoName = (repoUrl: string): string => {
  return repoUrl.replace("https://github.com/", "").replace(".git", "");
};

export const isValidEmail = (address: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address);
};

export const errorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : JSON.stringify(error);
};
