import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
import express from "express";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { JWT_SECRET } from "@repo/backend-common/config";
import { middleware } from "./middleware";
import {
  CreateRoomSchema,
  CreateUserSchema,
  SigninSchema,
  VerifySignupOtpSchema,
  ResendSignupOtpSchema,
  ForgotPasswordSchema,
  VerifyResetOtpSchema,
  ResetPasswordSchema,
} from "@repo/common/types";
import { prismaClient } from "@repo/db/client";
import bcrypt from "bcrypt";
import cors from "cors";
import {
  generateOtp,
  hashOtp,
  verifyOtpHash,
  getOtpExpiry,
  MAX_OTP_ATTEMPTS,
  RESEND_COOLDOWN_SECONDS,
} from "./otp";
import { sendSignupOtpEmail, sendResetOtpEmail } from "./mailer";

const app = express();
app.set("trust proxy", 1);
app.use(cors());
app.use(express.json());

const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again later." },
});

const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts. Please try again later." },
});

// ---------- SIGNUP with OTP ----------

app.post("/signup", otpRequestLimiter, async (req, res) => {
  const parsedData = CreateUserSchema.safeParse(req.body);
  if (!parsedData.success) {
    res.status(400).json({
      message: parsedData.error.issues[0]?.message || "Incorrect input",
    });
    return;
  }

  const { username: email, password, name } = parsedData.data;

  try {
    const existingUser = await prismaClient.user.findFirst({
      where: { email },
    });
    if (existingUser) {
      res.status(409).json({
        message: "An account with this email already exists. Please sign in instead.",
      });
      return;
    }

    const lastOtp = await prismaClient.otpVerification.findFirst({
      where: { email, purpose: "SIGNUP", consumed: false },
      orderBy: { createdAt: "desc" },
    });
    if (
      lastOtp &&
      Date.now() - lastOtp.createdAt.getTime() < RESEND_COOLDOWN_SECONDS * 1000
    ) {
      res.status(429).json({
        message: "Please wait before requesting another code.",
      });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOtp();
    const otpHash = await hashOtp(otp);

    await prismaClient.otpVerification.updateMany({
      where: { email, purpose: "SIGNUP", consumed: false },
      data: { consumed: true },
    });

    await prismaClient.otpVerification.create({
      data: {
        email,
        purpose: "SIGNUP",
        otpHash,
        expiresAt: getOtpExpiry(),
        pendingName: name,
        pendingPasswordHash: hashedPassword,
      },
    });

    await sendSignupOtpEmail(email, otp);

    res.json({ message: "OTP sent to your email." });
  } catch (e) {
    console.error("Signup error:", e);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

app.post("/verify-signup-otp", otpVerifyLimiter, async (req, res) => {
  const parsedData = VerifySignupOtpSchema.safeParse(req.body);
  if (!parsedData.success) {
    res.status(400).json({
      message: parsedData.error.issues[0]?.message || "Incorrect input",
    });
    return;
  }

  const { email, otp } = parsedData.data;

  try {
    const record = await prismaClient.otpVerification.findFirst({
      where: { email, purpose: "SIGNUP", consumed: false },
      orderBy: { createdAt: "desc" },
    });

    if (!record) {
      res.status(400).json({
        message: "No pending verification found. Please sign up again.",
      });
      return;
    }

    if (record.expiresAt < new Date()) {
      res.status(400).json({
        message: "OTP has expired. Please request a new OTP.",
      });
      return;
    }

    if (record.attempts >= MAX_OTP_ATTEMPTS) {
      res.status(429).json({
        message: "Too many incorrect attempts. Please request a new OTP.",
      });
      return;
    }

    const isValid = await verifyOtpHash(otp, record.otpHash);
    if (!isValid) {
      await prismaClient.otpVerification.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      res.status(400).json({ message: "Invalid OTP. Please try again." });
      return;
    }

    if (!record.pendingName || !record.pendingPasswordHash) {
      res.status(400).json({
        message: "Verification session is invalid. Please sign up again.",
      });
      return;
    }

    const user = await prismaClient.user.create({
      data: {
        email,
        password: record.pendingPasswordHash,
        name: record.pendingName,
        emailVerified: true,
      },
    });

    await prismaClient.otpVerification.update({
      where: { id: record.id },
      data: { consumed: true },
    });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET);
    res.json({ token });
  } catch (e: any) {
    if (e?.code === "P2002") {
      res.status(409).json({
        message: "An account with this email already exists. Please sign in instead.",
      });
      return;
    }
    console.error("Verify signup OTP error:", e);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

app.post("/resend-signup-otp", otpRequestLimiter, async (req, res) => {
  const parsedData = ResendSignupOtpSchema.safeParse(req.body);
  if (!parsedData.success) {
    res.status(400).json({
      message: parsedData.error.issues[0]?.message || "Incorrect input",
    });
    return;
  }

  const { email } = parsedData.data;

  try {
    const lastRecord = await prismaClient.otpVerification.findFirst({
      where: { email, purpose: "SIGNUP" },
      orderBy: { createdAt: "desc" },
    });

    if (!lastRecord || !lastRecord.pendingName || !lastRecord.pendingPasswordHash) {
      res.status(400).json({
        message: "Please start the signup process again.",
      });
      return;
    }

    if (
      !lastRecord.consumed &&
      Date.now() - lastRecord.createdAt.getTime() < RESEND_COOLDOWN_SECONDS * 1000
    ) {
      res.status(429).json({
        message: "Please wait before requesting another code.",
      });
      return;
    }

    const otp = generateOtp();
    const otpHash = await hashOtp(otp);

    await prismaClient.otpVerification.updateMany({
      where: { email, purpose: "SIGNUP", consumed: false },
      data: { consumed: true },
    });

    await prismaClient.otpVerification.create({
      data: {
        email,
        purpose: "SIGNUP",
        otpHash,
        expiresAt: getOtpExpiry(),
        pendingName: lastRecord.pendingName,
        pendingPasswordHash: lastRecord.pendingPasswordHash,
      },
    });

    await sendSignupOtpEmail(email, otp);

    res.json({ message: "New OTP sent successfully to your email." });
  } catch (e) {
    console.error("Resend signup OTP error:", e);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

// ---------- SIGNIN ----------

app.post("/signin", async (req, res) => {
  const parsedData = SigninSchema.safeParse(req.body);
  if (!parsedData.success) {
    res.status(400).json({
      message: parsedData.error.issues[0]?.message || "Incorrect inputs",
    });
    return;
  }

  const user = await prismaClient.user.findFirst({
    where: { email: parsedData.data.username },
  });

  if (!user) {
    res.status(403).json({
      message: "No account found with this email. Please sign up first.",
    });
    return;
  }

  const validPassword = await bcrypt.compare(parsedData.data.password, user.password);
  if (!validPassword) {
    res.status(403).json({ message: "Incorrect password. Please try again." });
    return;
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET);
  res.json({ token });
});

// ---------- FORGOT PASSWORD ----------

app.post("/forgot-password", otpRequestLimiter, async (req, res) => {
  const parsedData = ForgotPasswordSchema.safeParse(req.body);
  if (!parsedData.success) {
    res.status(400).json({
      message: parsedData.error.issues[0]?.message || "Incorrect input",
    });
    return;
  }

  const { email } = parsedData.data;
  const genericMessage = {
    message: "If an account exists with this email, a verification code has been sent.",
  };

  try {
    const user = await prismaClient.user.findFirst({ where: { email } });

    if (!user) {
      res.json(genericMessage);
      return;
    }

    const lastOtp = await prismaClient.otpVerification.findFirst({
      where: { email, purpose: "RESET", consumed: false },
      orderBy: { createdAt: "desc" },
    });
    if (
      lastOtp &&
      Date.now() - lastOtp.createdAt.getTime() < RESEND_COOLDOWN_SECONDS * 1000
    ) {
      res.json(genericMessage);
      return;
    }

    const otp = generateOtp();
    const otpHash = await hashOtp(otp);

    await prismaClient.otpVerification.updateMany({
      where: { email, purpose: "RESET", consumed: false },
      data: { consumed: true },
    });

    await prismaClient.otpVerification.create({
      data: {
        email,
        purpose: "RESET",
        otpHash,
        expiresAt: getOtpExpiry(),
      },
    });

    await sendResetOtpEmail(email, otp);

    res.json(genericMessage);
  } catch (e) {
    console.error("Forgot password error:", e);
    res.json(genericMessage);
  }
});

app.post("/verify-reset-otp", otpVerifyLimiter, async (req, res) => {
  const parsedData = VerifyResetOtpSchema.safeParse(req.body);
  if (!parsedData.success) {
    res.status(400).json({
      message: parsedData.error.issues[0]?.message || "Incorrect input",
    });
    return;
  }

  const { email, otp } = parsedData.data;

  try {
    const record = await prismaClient.otpVerification.findFirst({
      where: { email, purpose: "RESET", consumed: false },
      orderBy: { createdAt: "desc" },
    });

    if (!record) {
      res.status(400).json({
        message: "No pending reset request found. Please start again.",
      });
      return;
    }

    if (record.expiresAt < new Date()) {
      res.status(400).json({ message: "OTP has expired. Please request a new OTP." });
      return;
    }

    if (record.attempts >= MAX_OTP_ATTEMPTS) {
      res.status(429).json({
        message: "Too many incorrect attempts. Please request a new OTP.",
      });
      return;
    }

    const isValid = await verifyOtpHash(otp, record.otpHash);
    if (!isValid) {
      await prismaClient.otpVerification.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      res.status(400).json({ message: "Invalid OTP. Please try again." });
      return;
    }

    res.json({ message: "OTP verified. You can now reset your password." });
  } catch (e) {
    console.error("Verify reset OTP error:", e);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

app.post("/reset-password", otpVerifyLimiter, async (req, res) => {
  const parsedData = ResetPasswordSchema.safeParse(req.body);
  if (!parsedData.success) {
    res.status(400).json({
      message: parsedData.error.issues[0]?.message || "Incorrect input",
    });
    return;
  }

  const { email, otp, password } = parsedData.data;

  try {
    const record = await prismaClient.otpVerification.findFirst({
      where: { email, purpose: "RESET", consumed: false },
      orderBy: { createdAt: "desc" },
    });

    if (!record) {
      res.status(400).json({
        message: "No pending reset request found. Please start again.",
      });
      return;
    }

    if (record.expiresAt < new Date()) {
      res.status(400).json({ message: "OTP has expired. Please request a new OTP." });
      return;
    }

    if (record.attempts >= MAX_OTP_ATTEMPTS) {
      res.status(429).json({
        message: "Too many incorrect attempts. Please request a new OTP.",
      });
      return;
    }

    const isValid = await verifyOtpHash(otp, record.otpHash);
    if (!isValid) {
      await prismaClient.otpVerification.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      res.status(400).json({ message: "Invalid OTP. Please try again." });
      return;
    }

    const user = await prismaClient.user.findFirst({ where: { email } });
    if (!user) {
      res.status(400).json({ message: "Account not found." });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prismaClient.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    await prismaClient.otpVerification.update({
      where: { id: record.id },
      data: { consumed: true },
    });

    res.json({
      message: "Password reset successfully. Please log in with your new password.",
    });
  } catch (e) {
    console.error("Reset password error:", e);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

// ---------- ROOMS & CHATS (unchanged) ----------

app.post("/room", middleware, async (req, res) => {
  const parsedData = CreateRoomSchema.safeParse(req.body);
  if (!parsedData.success) {
    res.status(400).json({
      message: parsedData.error.issues[0]?.message || "Incorrect inputs",
    });
    return;
  }

  const userId = req.userId;
  try {
    const room = await prismaClient.room.create({
      data: {
        slug: parsedData.data.name,
        adminId: userId,
      },
    });
    res.json({ roomId: room.id });
  } catch (e) {
    res.status(500).json({ message: "Could not create room. Please try again." });
  }
});

app.get("/chats/:roomId", async (req, res) => {
  try {
    const roomId = Number(req.params.roomId);
    const messages = await prismaClient.chat.findMany({
      where: { roomId },
      orderBy: { id: "desc" },
      take: 1000,
    });
    res.json({ messages });
  } catch (e) {
    console.error("Error fetching chats:", e);
    res.json({ messages: [] });
  }
});

app.get("/room/:slug", async (req, res) => {
  const slug = req.params.slug;
  const room = await prismaClient.room.findFirst({ where: { slug } });
  res.json({ room });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`HTTP server running on port ${PORT}`);
});