"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import { Eye, EyeOff, Check, X, ArrowLeft } from "lucide-react";
import { HTTP_BACKEND } from "@/config";
import { SketchArt } from "./SketchArt";
import { Logo } from "./Logo";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_COOLDOWN = 60;

export function AuthPage({ isSignin }: { isSignin: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "otp">("form");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpNotice, setOtpNotice] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const passwordChecks = useMemo(
    () => ({
      length: password.length > 8,
      capital: /^[A-Z]/.test(password),
      number: /[0-9]/.test(password),
      symbol: /[^a-zA-Z0-9]/.test(password),
    }),
    [password]
  );

  const emailValid = EMAIL_REGEX.test(email.trim());
  const nameValid = name.trim().length >= 2;
  const passwordValid =
    passwordChecks.length &&
    passwordChecks.capital &&
    passwordChecks.number &&
    passwordChecks.symbol;
  const confirmValid = isSignin || confirmPassword === password;

  const canSubmit = isSignin
    ? emailValid && password.length > 0
    : nameValid && emailValid && passwordValid && confirmValid;

  function markTouched(field: string) {
    setTouched((t) => ({ ...t, [field]: true }));
  }

  function startCooldown() {
    setCooldown(RESEND_COOLDOWN);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1 && timerRef.current) {
          clearInterval(timerRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  async function handleSubmit() {
    setServerError("");

    if (!canSubmit) {
      setTouched({
        name: true,
        email: true,
        password: true,
        confirmPassword: true,
      });
      return;
    }

    setLoading(true);
    try {
      if (isSignin) {
        const res = await axios.post(`${HTTP_BACKEND}/signin`, {
          username: email.trim().toLowerCase(),
          password,
        });
        localStorage.setItem("token", res.data.token);
        router.push("/dashboard");
      } else {
        await axios.post(`${HTTP_BACKEND}/signup`, {
          username: email.trim().toLowerCase(),
          password,
          name: name.trim(),
        });
        setStep("otp");
        startCooldown();
      }
    } catch (e: any) {
      setServerError(
        e?.response?.data?.message || "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    setOtpError("");
    setOtpNotice("");

    if (otp.length !== 6) {
      setOtpError("Enter the 6-digit OTP.");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${HTTP_BACKEND}/verify-signup-otp`, {
        email: email.trim().toLowerCase(),
        otp,
      });
      localStorage.setItem("token", res.data.token);
      router.push("/dashboard");
    } catch (e: any) {
      setOtpError(e?.response?.data?.message || "Invalid OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResendOtp() {
    if (cooldown > 0) return;
    setOtpError("");
    setOtpNotice("");
    setLoading(true);
    try {
      const res = await axios.post(`${HTTP_BACKEND}/resend-signup-otp`, {
        email: email.trim().toLowerCase(),
      });
      setOtpNotice(res.data.message || "New OTP sent successfully to your email.");
      startCooldown();
    } catch (e: any) {
      setOtpError(
        e?.response?.data?.message || "Could not resend OTP. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  function goBackToForm() {
    setStep("form");
    setOtp("");
    setOtpError("");
    setOtpNotice("");
    if (timerRef.current) clearInterval(timerRef.current);
  }

  const fieldFont = { fontFamily: "'Plus Jakarta Sans', sans-serif" };

  return (
    <div className="flex min-h-screen w-full flex-col lg:flex-row bg-[#F3EFE6]">
      {/* Left: animated canvas panel */}
      <div className="relative flex h-56 w-full items-center justify-center overflow-hidden bg-[#14171B] lg:h-auto lg:w-[58%]">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(#F3EFE6 1px, transparent 1px), linear-gradient(90deg, #F3EFE6 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div
          className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full opacity-20 blur-3xl"
          style={{ background: isSignin ? "#3B5BFF" : "#FFB020" }}
        />

        <Logo className="absolute left-8 top-8 lg:left-16 lg:top-10" />

        <SketchArt
          variant={isSignin ? "signin" : "signup"}
          className="relative h-40 w-40 text-[#F3EFE6]/80 lg:h-72 lg:w-72"
        />

        <p
          className="absolute bottom-8 left-8 -rotate-3 text-xl text-[#FFB020] lg:bottom-10 lg:left-16 lg:text-3xl"
          style={{ fontFamily: "'Caveat', cursive" }}
        >
          {isSignin ? "good to see you again" : "sketch it out, together"}
        </p>
      </div>

      {/* Right: form panel */}
      <div className="flex flex-1 items-center justify-center px-6 py-16 lg:px-20">
        <div className="w-full max-w-sm">
          {step === "form" ? (
            <>
              <h2
                className="mb-2 text-4xl text-[#1E2530]"
                style={{ fontFamily: "'Fraunces', serif" }}
              >
                {isSignin ? "Welcome back" : "Start sketching"}
              </h2>
              <p className="mb-8 text-sm text-[#1E2530]/60" style={fieldFont}>
                {isSignin
                  ? "Sign in to jump back into your rooms."
                  : "Create an account to start drawing with others."}
              </p>

              <div className="flex flex-col gap-6" style={fieldFont}>
                {!isSignin && (
                  <div className="relative">
                    <input
                      id="name"
                      type="text"
                      placeholder=" "
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onBlur={() => markTouched("name")}
                      className={`peer w-full border-b-2 bg-transparent py-2 text-[#1E2530] outline-none transition-colors ${touched.name && !nameValid
                          ? "border-[#C0392B]"
                          : "border-[#D8D2C4] focus:border-[#3B5BFF]"
                        }`}
                    />
                    <label
                      htmlFor="name"
                      className="pointer-events-none absolute left-0 top-2 text-base text-[#1E2530]/40 transition-all peer-focus:-top-3.5 peer-focus:text-xs peer-focus:text-[#3B5BFF] peer-[:not(:placeholder-shown)]:-top-3.5 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:text-[#1E2530]/50"
                    >
                      Name
                    </label>
                    {touched.name && !nameValid && (
                      <p className="mt-1 text-xs text-[#C0392B]">
                        Name must be at least 2 characters
                      </p>
                    )}
                  </div>
                )}

                <div className="relative">
                  <input
                    id="email"
                    type="text"
                    placeholder=" "
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={() => markTouched("email")}
                    className={`peer w-full border-b-2 bg-transparent py-2 text-[#1E2530] outline-none transition-colors ${touched.email && !emailValid
                        ? "border-[#C0392B]"
                        : "border-[#D8D2C4] focus:border-[#3B5BFF]"
                      }`}
                  />
                  <label
                    htmlFor="email"
                    className="pointer-events-none absolute left-0 top-2 text-base text-[#1E2530]/40 transition-all peer-focus:-top-3.5 peer-focus:text-xs peer-focus:text-[#3B5BFF] peer-[:not(:placeholder-shown)]:-top-3.5 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:text-[#1E2530]/50"
                  >
                    Email
                  </label>
                  {touched.email && !emailValid && (
                    <p className="mt-1 text-xs text-[#C0392B]">
                      Enter a valid email address
                    </p>
                  )}
                </div>

                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder=" "
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onBlur={() => markTouched("password")}
                    className={`peer w-full border-b-2 bg-transparent py-2 pr-8 text-[#1E2530] outline-none transition-colors ${touched.password && !isSignin && !passwordValid
                        ? "border-[#C0392B]"
                        : "border-[#D8D2C4] focus:border-[#3B5BFF]"
                      }`}
                  />
                  <label
                    htmlFor="password"
                    className="pointer-events-none absolute left-0 top-2 text-base text-[#1E2530]/40 transition-all peer-focus:-top-3.5 peer-focus:text-xs peer-focus:text-[#3B5BFF] peer-[:not(:placeholder-shown)]:-top-3.5 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:text-[#1E2530]/50"
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-0 top-2.5 text-[#1E2530]/40 hover:text-[#1E2530]"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>

                  {isSignin && (
                    <div className="mt-2 text-right">
                      <Link
                        href="/forgot-password"
                        className="text-xs font-medium text-[#3B5BFF]"
                      >
                        Forgot password?
                      </Link>
                    </div>
                  )}

                  {!isSignin && (password.length > 0 || touched.password) && (
                    <ul className="mt-2 flex flex-col gap-1 text-xs">
                      <li
                        className={`flex items-center gap-1.5 ${passwordChecks.capital ? "text-[#2E7D32]" : "text-[#1E2530]/40"
                          }`}
                      >
                        {passwordChecks.capital ? <Check size={13} /> : <X size={13} />}
                        Starts with a capital letter
                      </li>
                      <li
                        className={`flex items-center gap-1.5 ${passwordChecks.number ? "text-[#2E7D32]" : "text-[#1E2530]/40"
                          }`}
                      >
                        {passwordChecks.number ? <Check size={13} /> : <X size={13} />}
                        Contains a number
                      </li>
                      <li
                        className={`flex items-center gap-1.5 ${passwordChecks.symbol ? "text-[#2E7D32]" : "text-[#1E2530]/40"
                          }`}
                      >
                        {passwordChecks.symbol ? <Check size={13} /> : <X size={13} />}
                        Contains a symbol (e.g. ! @ # $)
                      </li>
                      <li
                        className={`flex items-center gap-1.5 ${passwordChecks.length ? "text-[#2E7D32]" : "text-[#1E2530]/40"
                          }`}
                      >
                        {passwordChecks.length ? <Check size={13} /> : <X size={13} />}
                        More than 8 characters
                      </li>
                    </ul>
                  )}
                </div>

                {!isSignin && (
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      placeholder=" "
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      onBlur={() => markTouched("confirmPassword")}
                      className={`peer w-full border-b-2 bg-transparent py-2 text-[#1E2530] outline-none transition-colors ${touched.confirmPassword && !confirmValid
                          ? "border-[#C0392B]"
                          : "border-[#D8D2C4] focus:border-[#3B5BFF]"
                        }`}
                    />
                    <label
                      htmlFor="confirmPassword"
                      className="pointer-events-none absolute left-0 top-2 text-base text-[#1E2530]/40 transition-all peer-focus:-top-3.5 peer-focus:text-xs peer-focus:text-[#3B5BFF] peer-[:not(:placeholder-shown)]:-top-3.5 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:text-[#1E2530]/50"
                    >
                      Confirm password
                    </label>
                    {touched.confirmPassword && !confirmValid && (
                      <p className="mt-1 text-xs text-[#C0392B]">
                        Passwords don't match
                      </p>
                    )}
                  </div>
                )}

                {serverError && (
                  <div className="text-sm text-[#C0392B]">{serverError}</div>
                )}

                <button
                  disabled={loading}
                  onClick={handleSubmit}
                  className="group relative mt-2 w-full overflow-hidden rounded-full bg-[#1E2530] px-6 py-3 text-[#F3EFE6] transition-transform active:scale-[0.98] disabled:opacity-50"
                >
                  <span className="relative z-10 font-medium">
                    {loading
                      ? isSignin
                        ? "Signing in..."
                        : "Sending OTP..."
                      : isSignin
                        ? "Sign in"
                        : "Create account"}
                  </span>
                  <svg
                    className="pointer-events-none absolute inset-x-6 bottom-2 h-2 w-[calc(100%-3rem)]"
                    viewBox="0 0 200 8"
                    preserveAspectRatio="none"
                  >
                    <path
                      d="M2 5c30-6 60 4 96-2s70 6 100-1"
                      stroke="#FFB020"
                      strokeWidth="2"
                      strokeLinecap="round"
                      fill="none"
                      className="[stroke-dasharray:260] [stroke-dashoffset:260] transition-[stroke-dashoffset] duration-500 ease-out group-hover:[stroke-dashoffset:0]"
                    />
                  </svg>
                </button>

                <p className="text-center text-sm text-[#1E2530]/60">
                  {isSignin ? (
                    <>
                      New here?{" "}
                      <Link href="/signup" className="font-medium text-[#3B5BFF]">
                        Create an account
                      </Link>
                    </>
                  ) : (
                    <>
                      Already sketching with us?{" "}
                      <Link href="/signin" className="font-medium text-[#3B5BFF]">
                        Sign in
                      </Link>
                    </>
                  )}
                </p>
              </div>
            </>
          ) : (
            <>
              <button
                onClick={goBackToForm}
                className="mb-6 flex items-center gap-1 text-sm text-[#1E2530]/60 hover:text-[#1E2530]"
                style={fieldFont}
              >
                <ArrowLeft size={14} /> Change email
              </button>

              <h2
                className="mb-2 text-3xl text-[#1E2530]"
                style={{ fontFamily: "'Fraunces', serif" }}
              >
                Check your email
              </h2>
              <p className="mb-8 text-sm text-[#1E2530]/60" style={fieldFont}>
                Enter the 6-digit OTP sent to <strong>{email}</strong>
              </p>
              <p className="mb-8 text-xs text-[#1E2530]/40" style={fieldFont}>
                Don't see it? Check your spam or junk folder.
              </p>

              <div className="flex flex-col gap-5" style={fieldFont}>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={otp}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))
                  }
                  className="w-full rounded-xl border-2 border-[#D8D2C4] bg-transparent px-4 py-3 text-center text-2xl tracking-[0.5em] text-[#1E2530] outline-none transition-colors focus:border-[#3B5BFF]"
                />

                {otpError && <div className="text-sm text-[#C0392B]">{otpError}</div>}
                {otpNotice && (
                  <div className="text-sm text-[#2E7D32]">{otpNotice}</div>
                )}

                <button
                  disabled={loading}
                  onClick={handleVerifyOtp}
                  className="w-full rounded-full bg-[#1E2530] px-6 py-3 font-medium text-[#F3EFE6] transition-transform active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? "Verifying OTP..." : "Verify OTP"}
                </button>

                <button
                  disabled={cooldown > 0 || loading}
                  onClick={handleResendOtp}
                  className="text-sm font-medium text-[#3B5BFF] disabled:text-[#1E2530]/30"
                >
                  {cooldown > 0
                    ? `Resend OTP in ${cooldown}s`
                    : "Resend OTP"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}