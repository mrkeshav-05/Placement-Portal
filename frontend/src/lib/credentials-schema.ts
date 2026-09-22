import { z } from "zod";

export const MIN_PASSWORD_LENGTH = 10;

const emailField = z
  .string()
  .trim()
  .min(1, "Email is required")
  .max(254, "Email is too long")
  .email("Enter a valid email address")
  .transform((value) => value.toLowerCase());

export const passwordLoginSchema = z.object({
  email: emailField,
  // Only a presence check: the stored hash decides, and a length rule here
  // would tell an attacker which guesses were even worth hashing.
  password: z.string().min(1, "Password is required").max(200),
});

const newPasswordField = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters`)
  .max(200, "Password is too long")
  .refine((value) => /[a-zA-Z]/.test(value) && /\d/.test(value), {
    message: "Include at least one letter and one number",
  });

export const registrationSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your full name").max(120, "Name is too long"),
    email: emailField,
    password: newPasswordField,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

/**
 * Setting a password from inside a session is how staff obtain one: their
 * account already exists, so registration refuses it. An account that already
 * has a password must confirm the old one, which is what stops a borrowed
 * session from locking the owner out.
 */
export const setPasswordSchema = z
  .object({
    currentPassword: z.string().max(200).optional(),
    password: newPasswordField,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

/** The code from a registration OTP email. Six digits, nothing else. */
export const registrationOtpSchema = z.object({
  email: emailField,
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code from your email"),
});

export type PasswordLoginInput = z.infer<typeof passwordLoginSchema>;
export type RegistrationInput = z.infer<typeof registrationSchema>;
export type SetPasswordInput = z.infer<typeof setPasswordSchema>;
export type RegistrationOtpInput = z.infer<typeof registrationOtpSchema>;
