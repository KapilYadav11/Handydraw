import { z } from "zod";

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Email is required")
  .email("Enter a valid email address")
  .max(254, "Email is too long");

const strongPasswordField = z
  .string()
  .min(9, "Password must be more than 8 characters")
  .max(72, "Password is too long")
  .regex(/^[A-Z]/, "Password must start with a capital letter")
  .regex(/[0-9]/, "Password must include at least one number")
  .regex(/[^a-zA-Z0-9]/, "Password must include at least one symbol");

const otpField = z
  .string()
  .trim()
  .length(6, "OTP must be 6 digits")
  .regex(/^[0-9]{6}$/, "OTP must be 6 digits");

const roomNameField = z
  .string()
  .trim()
  .min(3, "Team name must be at least 3 characters")
  .max(30, "Team name must be under 30 characters")
  .regex(
    /^[a-zA-Z0-9-_ ]+$/,
    "Team name can only contain letters, numbers, spaces, - and _"
  );

const roomPasswordField = z
  .string()
  .min(4, "Room password must be at least 4 characters")
  .max(50, "Room password is too long");

export const CreateUserSchema = z.object({
  username: emailField,
  password: strongPasswordField,
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name is too long"),
});

export const SigninSchema = z.object({
  username: emailField,
  password: z.string().min(1, "Password is required"),
});

export const CreateRoomSchema = z.object({
  name: roomNameField,
  password: roomPasswordField,
});

export const JoinRoomSchema = z.object({
  name: roomNameField,
  password: z.string().min(1, "Password is required"),
});

export const VerifySignupOtpSchema = z.object({
  email: emailField,
  otp: otpField,
});

export const ResendSignupOtpSchema = z.object({
  email: emailField,
});

export const ForgotPasswordSchema = z.object({
  email: emailField,
});

export const VerifyResetOtpSchema = z.object({
  email: emailField,
  otp: otpField,
});

export const ResetPasswordSchema = z.object({
  email: emailField,
  otp: otpField,
  password: strongPasswordField,
});