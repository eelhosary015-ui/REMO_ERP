import React, { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  Lock,
  User,
  ChefHat,
  LogIn,
  Eye,
  EyeOff,
  Sparkles,
  Smartphone,
  Settings,
  Server,
  Check,
  RefreshCw,
  Globe,
  Moon,
  Sun,
  Database,
  Cpu,
  Bot,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Monitor,
  KeyRound,
  Box,
  Boxes,
  Hexagon,
  Triangle,
} from "lucide-react";
import { motion } from "motion/react";
import { resolveUrl, getBaseUrl, isUsableAuthToken } from "../utils/api";

export const Login: React.FC<{ systemName?: string; onOpenMobilePortal?: () => void }> = ({
  systemName = "REMO PRO ERP",
  onOpenMobilePortal,
}) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [isLoadingForm, setIsLoadingForm] = useState(false);
  const [forcePasswordChange, setForcePasswordChange] = useState(false);
  // Session issued by /api/login while the user is still forced to change the
  // password. It is kept in memory (not in localStorage) until the change
  // succeeds, because the app must not be considered signed in before that.
  const [pendingAuth, setPendingAuth] = useState<{ token: string; user: any } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [lang, setLang] = useState<"ar" | "en">("ar");
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    return (localStorage.getItem("app_login_theme") as "dark" | "light") || "light";
  });
  const { login } = useAuth();
  const [loginBg, setLoginBg] = useState<{ url: string; type: "image" | "video" } | null>(null);

  // === 3D Mouse Parallax Tracking ===
  const [mouse3D, setMouse3D] = useState({ x: 0, y: 0 });
  const sceneRef = useRef<HTMLDivElement>(null);

  // === Cursor follower state (screen-absolute position) ===
  const [cursorPos, setCursorPos] = useState({ x: -100, y: -100 });
  const [cursorTrailPos, setCursorTrailPos] = useState({ x: -100, y: -100 });

  useEffect(() => {
    let rafTrail = 0;
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;  // -1 to 1
      const y = (e.clientY / window.innerHeight - 0.5) * 2; // -1 to 1
      setMouse3D({ x, y });
      // Immediate glow position
      setCursorPos({ x: e.clientX, y: e.clientY });
      // Trail follows with delay via rAF
      cancelAnimationFrame(rafTrail);
      rafTrail = requestAnimationFrame(() => {
        setCursorTrailPos({ x: e.clientX, y: e.clientY });
      });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(rafTrail);
    };
  }, []);

  // === Magnetic Sign-In Button ===
  const [btnOffset, setBtnOffset] = useState({ x: 0, y: 0 });
  const handleBtnMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    setBtnOffset({ x: x * 0.3, y: y * 0.4 });
  };
  const handleBtnMouseLeave = () => setBtnOffset({ x: 0, y: 0 });

  // === Ripple effect on click ===
  const [ripples, setRipples] = useState<Array<{ x: number; y: number; id: number }>>([]);
  const handleBtnClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const id = Date.now();
    setRipples(prev => [...prev, { x: e.clientX - rect.left, y: e.clientY - rect.top, id }]);
    setTimeout(() => setRipples(prev => prev.filter(r => r.id !== id)), 600);
  };

  // === Count-up animation for dashboard numbers ===
  const useCountUp = (target: number, duration = 1500) => {
    const [value, setValue] = useState(0);
    useEffect(() => {
      let raf = 0;
      const start = performance.now();
      const tick = (now: number) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        // easeOutExpo
        const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        setValue(Math.round(target * eased));
        if (progress < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }, [target, duration]);
    return value;
  };

  const employeesCount = useCountUp(1246);
  const revenueCount = useCountUp(98765);

  // === Stagger text for welcome heading ===
  // For Arabic: split into WORDS (splitting letters breaks Arabic shaping/joining).
  // For English/Latin: split into individual letters (looks better with the flip animation).
  const welcomeText = lang === "ar" ? "مرحباً بك مجدداً" : "Welcome Back";
  const welcomeChunks = useMemo(() => {
    if (lang === "ar") {
      // Split by space → preserve each word's letter-joining
      return welcomeText.split(" ");
    }
    return Array.from(welcomeText);
  }, [welcomeText, lang]);

  // 3D tilt values derived from mouse position
  const tiltX = mouse3D.y * -10;  // -10 to 10 deg
  const tiltY = mouse3D.x * 10;   // -10 to 10 deg
  const parallaxX = mouse3D.x * 25; // px shift for background layers
  const parallaxY = mouse3D.y * 25;

  // Generate stable particle configs (positions/delays) once
  const particles = useMemo(() =>
    Array.from({ length: 18 }).map((_, i) => ({
      left: `${(i * 53) % 100}%`,
      top: `${(i * 37 + 13) % 100}%`,
      delay: `${(i * 0.7) % 8}s`,
      duration: `${8 + (i % 5) * 2}s`,
      dx: `${(i % 7) * 10 - 30}px`,
      dy: `${-60 - (i % 4) * 15}px`,
      dz: `${(i % 3) * 30 - 30}px`,
    })),
  []);


  // Server Connection Configuration State
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [serverUrlInput, setServerUrlInput] = useState(localStorage.getItem('API_BASE_URL') || "");

  const handleSaveServer = () => {
    let trimmed = serverUrlInput.trim();
    if (!trimmed) {
      localStorage.removeItem('API_BASE_URL');
    } else {
      if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
        trimmed = "http://" + trimmed;
      }
      localStorage.setItem('API_BASE_URL', trimmed);
    }
    window.location.reload();
  };

  React.useEffect(() => {
    const fetchLoginBg = async () => {
      try {
        let res: Response | null = null;
        try {
          res = await fetch(resolveUrl("/api/settings/login_background"), { headers: { "Accept": "application/json" } });
        } catch {
          // If custom API_BASE_URL failed, fallback to current origin
          res = await fetch("/api/settings/login_background", { headers: { "Accept": "application/json" } });
        }
        if (res && res.ok) {
          const text = await res.text();
          if (text && !text.startsWith("<")) {
            const data = JSON.parse(text);
            if (data.value) {
              setLoginBg(JSON.parse(data.value));
            }
          }
        }
      } catch (err) {
        // Silently use default background theme if custom background fetch fails
      }
    };
    fetchLoginBg();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoadingForm(true);

    try {
      const response = await fetch(resolveUrl("/api/login"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.requirePasswordChange) {
          // Keep the token from this login response: /api/auth/change-password is
          // authenticated, and the session is not stored yet at this point.
          setPendingAuth({ token: data.token, user: data.user });
          setNewPassword("");
          setConfirmPassword("");
          setForcePasswordChange(true);
          setIsLoadingForm(false);
          return;
        }
        setPendingAuth(null);
        login(data.token, data.user);
      } else {
        setError(data.error || (lang === "ar" ? "اسم المستخدم أو كلمة المرور غير صحيحة." : "Invalid username or password."));
      }
    } catch (err) {
      setError(lang === "ar" ? "حدث خطأ أثناء الاتصال بالخادم. يرجى التأكد من عنوان السيرفر والمحاولة مرة أخرى." : "Server connection failed. Please check server address.");
    } finally {
      setIsLoadingForm(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 8) { setError(lang === "ar" ? "كلمة المرور يجب أن تكون 8 أحرف على الأقل" : "Password must be at least 8 characters"); return; }
    if (newPassword !== confirmPassword) { setError(lang === "ar" ? "كلمتا المرور غير متطابقتين" : "Passwords do not match"); return; }
    // The forced-change screen is rendered before the session is stored, so the
    // token has to come from the login response first and only then from
    // localStorage. Sending "Bearer null" here produced 401 AUTH_REQUIRED.
    const storedToken = localStorage.getItem("token");
    const token =
      pendingAuth && isUsableAuthToken(pendingAuth.token)
        ? pendingAuth.token
        : isUsableAuthToken(storedToken)
          ? storedToken
          : null;

    if (!token) {
      setForcePasswordChange(false);
      setPendingAuth(null);
      setNewPassword("");
      setConfirmPassword("");
      setError(
        lang === "ar"
          ? "انتهت جلسة الدخول قبل حفظ كلمة المرور الجديدة. يرجى تسجيل الدخول من جديد."
          : "Your sign-in session ended before the new password was saved. Please sign in again."
      );
      return;
    }

    setIsLoadingForm(true);
    try {
      const res = await fetch(resolveUrl("/api/auth/change-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: password, newPassword }),
      });

      const text = await res.text();
      let data: any = {};
      if (text && !text.startsWith("<")) {
        try {
          data = JSON.parse(text);
        } catch {
          data = {};
        }
      }

      if (res.ok) {
        setPassword("");
        setNewPassword("");
        setConfirmPassword("");
        if (pendingAuth?.user) {
          // Password saved: the same JWT stays valid and must_change_password is
          // already cleared server-side, so the session can be opened.
          const sessionUser = pendingAuth.user;
          setPendingAuth(null);
          login(token, sessionUser);
        } else {
          setForcePasswordChange(false);
          setPendingAuth(null);
          setError(
            lang === "ar"
              ? "تم تغيير كلمة المرور بنجاح. يرجى تسجيل الدخول بكلمة المرور الجديدة."
              : "Password changed successfully. Please sign in with your new password."
          );
        }
      } else if (
        data.error === "AUTH_REQUIRED" ||
        data.error === "TOKEN_INVALID" ||
        data.error === "TOKEN_EXPIRED"
      ) {
        setForcePasswordChange(false);
        setPendingAuth(null);
        setNewPassword("");
        setConfirmPassword("");
        setError(
          lang === "ar"
            ? "انتهت جلسة الدخول. يرجى تسجيل الدخول من جديد ثم تغيير كلمة المرور."
            : "Your sign-in session ended. Please sign in again and then change the password."
        );
      } else {
        setError(data.error || (lang === "ar" ? "فشل تغيير كلمة المرور" : "Failed to change password"));
      }
    } catch {
      setError(lang === "ar" ? "حدث خطأ أثناء تغيير كلمة المرور" : "An error occurred while changing the password");
    } finally {
      setIsLoadingForm(false);
    }
  };

  const isLight = theme === "light";

  return (
    <div
      ref={sceneRef}
      className={`scene-3d min-h-screen w-full transition-colors duration-300 font-cairo overflow-hidden relative flex flex-col justify-between selection:bg-blue-600 selection:text-white ${
        isLight ? "bg-slate-50 text-slate-900" : "bg-[#050b18] text-slate-100"
      }`}
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      {/* === 3D Background Layer: ambient lighting, floating shapes, grid floor, particles === */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0 preserve-3d">
        {/* Ambient gradient blobs */}
        <div
          className={`absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full blur-[140px] transition-transform duration-300 ${
            isLight ? "bg-blue-400/20" : "bg-blue-600/15"
          }`}
          style={{ transform: `translate3d(${parallaxX * 0.5}px, ${parallaxY * 0.5}px, 0)` }}
        />
        <div
          className={`absolute bottom-0 right-[10%] w-[50%] h-[50%] rounded-full blur-[160px] transition-transform duration-300 ${
            isLight ? "bg-cyan-400/20" : "bg-cyan-500/10"
          }`}
          style={{ transform: `translate3d(${-parallaxX * 0.4}px, ${-parallaxY * 0.4}px, 0)` }}
        />
        <div
          className={`absolute top-[40%] left-[45%] w-[35%] h-[35%] rounded-full blur-[120px] transition-transform duration-300 ${
            isLight ? "bg-indigo-300/15" : "bg-indigo-600/8"
          }`}
          style={{ transform: `translate3d(${parallaxX * 0.7}px, ${parallaxY * 0.7}px, 0)` }}
        />

        {/* Dotted grid texture */}
        <div
          className={`absolute inset-0 [background-size:32px_32px] opacity-25 ${
            isLight
              ? "bg-[radial-gradient(#cbd5e1_1px,transparent_1px)]"
              : "bg-[radial-gradient(#1e293b_1px,transparent_1px)]"
          }`}
        />

        {/* === 3D Perspective Grid Floor (bottom of screen) === */}
        <div
          className="absolute bottom-0 left-0 right-0 h-[40%] overflow-hidden"
          style={{ opacity: isLight ? 0.4 : 0.5 }}
        >
          <div
            className="grid-floor-3d absolute inset-x-[-50%] bottom-0 h-[120%]"
            style={{
              maskImage: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)",
              WebkitMaskImage: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)",
            }}
          />
        </div>

        {/* === Floating 3D Cube (top-left) === */}
        <div
          className="absolute top-[15%] left-[8%] transition-transform duration-300"
          style={{
            transform: `translate3d(${parallaxX * 1.2}px, ${parallaxY * 1.2}px, 60px)`,
            transformStyle: "preserve-3d",
          }}
        >
          <div className="cube-3d w-20 h-20" style={{ "--cube-half": "40px" } as React.CSSProperties}>
            <div className="face face-front" />
            <div className="face face-back" />
            <div className="face face-right" />
            <div className="face face-left" />
            <div className="face face-top" />
            <div className="face face-bottom" />
          </div>
        </div>

        {/* === Floating 3D Cube (bottom-right, smaller) === */}
        <div
          className="absolute bottom-[20%] right-[12%] transition-transform duration-300"
          style={{
            transform: `translate3d(${-parallaxX * 1.5}px, ${-parallaxY * 1.5}px, 80px)`,
            transformStyle: "preserve-3d",
          }}
        >
          <div className="cube-3d w-12 h-12" style={{ "--cube-half": "24px" } as React.CSSProperties}>
            <div className="face face-front" />
            <div className="face face-back" />
            <div className="face face-right" />
            <div className="face face-left" />
            <div className="face face-top" />
            <div className="face face-bottom" />
          </div>
        </div>

        {/* === Floating Glassmorphism Orbs === */}
        <div
          className="orb-3d absolute top-[25%] right-[18%] w-24 h-24 transition-transform duration-300"
          style={{
            transform: `translate3d(${parallaxX * 0.8}px, ${parallaxY * 0.8}px, 40px)`,
            background: isLight
              ? "radial-gradient(circle at 30% 30%, rgba(34,211,238,0.4), rgba(59,130,246,0.1))"
              : "radial-gradient(circle at 30% 30%, rgba(34,211,238,0.5), rgba(99,102,241,0.1))",
            boxShadow: isLight
              ? "0 0 40px rgba(34,211,238,0.3), inset 0 0 20px rgba(255,255,255,0.4)"
              : "0 0 50px rgba(34,211,238,0.4), inset 0 0 25px rgba(34,211,238,0.2)",
          }}
        />
        <div
          className="orb-3d absolute bottom-[30%] left-[15%] w-16 h-16 transition-transform duration-300"
          style={{
            transform: `translate3d(${-parallaxX * 1.1}px, ${-parallaxY * 1.1}px, 30px)`,
            animationDelay: "-4s",
            background: isLight
              ? "radial-gradient(circle at 30% 30%, rgba(168,85,247,0.35), rgba(99,102,241,0.1))"
              : "radial-gradient(circle at 30% 30%, rgba(168,85,247,0.5), rgba(99,102,241,0.1))",
            boxShadow: isLight
              ? "0 0 35px rgba(168,85,247,0.25), inset 0 0 18px rgba(255,255,255,0.4)"
              : "0 0 45px rgba(168,85,247,0.35), inset 0 0 22px rgba(168,85,247,0.2)",
          }}
        />
        <div
          className="orb-3d absolute top-[60%] right-[8%] w-10 h-10 transition-transform duration-300"
          style={{
            transform: `translate3d(${parallaxX * 1.4}px, ${-parallaxY * 0.9}px, 50px)`,
            animationDelay: "-7s",
            background: isLight
              ? "radial-gradient(circle at 30% 30%, rgba(16,185,129,0.4), rgba(14,165,233,0.1))"
              : "radial-gradient(circle at 30% 30%, rgba(16,185,129,0.55), rgba(14,165,233,0.1))",
          }}
        />

        {/* === Floating Lucide Geometric Icons (parallax depth layers) === */}
        <Box
          className={`absolute top-[18%] right-[28%] w-10 h-10 transition-all duration-300 ${
            isLight ? "text-cyan-500/40" : "text-cyan-400/30"
          }`}
          style={{
            transform: `translate3d(${parallaxX * 1.8}px, ${parallaxY * 1.8}px, 100px) rotate(${tiltY * 2}deg)`,
            filter: "drop-shadow(0 0 8px currentColor)",
          }}
        />
        <Hexagon
          className={`absolute bottom-[25%] right-[35%] w-8 h-8 transition-all duration-300 ${
            isLight ? "text-indigo-500/40" : "text-indigo-400/30"
          }`}
          style={{
            transform: `translate3d(${-parallaxX * 2}px, ${-parallaxY * 2}px, 90px) rotate(${tiltX * 2}deg)`,
            filter: "drop-shadow(0 0 8px currentColor)",
          }}
        />
        <Triangle
          className={`absolute top-[50%] left-[6%] w-7 h-7 transition-all duration-300 ${
            isLight ? "text-blue-500/40" : "text-blue-400/30"
          }`}
          style={{
            transform: `translate3d(${parallaxX * 2.2}px, ${-parallaxY * 1.6}px, 110px) rotate(${tiltY * 3}deg)`,
            filter: "drop-shadow(0 0 6px currentColor)",
          }}
        />
        <Boxes
          className={`absolute top-[70%] left-[40%] w-9 h-9 transition-all duration-300 ${
            isLight ? "text-purple-500/30" : "text-purple-400/25"
          }`}
          style={{
            transform: `translate3d(${parallaxX * 1.5}px, ${-parallaxY * 1.8}px, 70px) rotate(${tiltX * 3}deg)`,
            filter: "drop-shadow(0 0 8px currentColor)",
          }}
        />

        {/* === Floating 3D Particles === */}
        {particles.map((p, i) => (
          <span
            key={i}
            className="particle-3d"
            style={{
              left: p.left,
              top: p.top,
              animationDelay: p.delay,
              animationDuration: p.duration,
              "--dx": p.dx,
              "--dy": p.dy,
              "--dz": p.dz,
              "--duration": p.duration,
            } as React.CSSProperties}
          />
        ))}

        {/* === Aurora Wave Layers (animated background waves) === */}
        <div className="aurora-wave" style={{
          bottom: "-20%",
          left: "-20%",
          background: isLight
            ? "linear-gradient(90deg, rgba(34,211,238,0.25), rgba(59,130,246,0.2), rgba(168,85,247,0.18))"
            : "linear-gradient(90deg, rgba(34,211,238,0.35), rgba(59,130,246,0.25), rgba(168,85,247,0.22))",
          animationDelay: "0s",
        }} />
        <div className="aurora-wave" style={{
          bottom: "-15%",
          left: "-10%",
          height: "180px",
          background: isLight
            ? "linear-gradient(90deg, rgba(168,85,247,0.18), rgba(99,102,241,0.2))"
            : "linear-gradient(90deg, rgba(168,85,247,0.25), rgba(99,102,241,0.28))",
          animationDelay: "-5s",
          animationDuration: "18s",
        }} />
        <div className="aurora-wave" style={{
          bottom: "-25%",
          left: "5%",
          height: "220px",
          background: isLight
            ? "linear-gradient(90deg, rgba(16,185,129,0.18), rgba(34,211,238,0.22))"
            : "linear-gradient(90deg, rgba(16,185,129,0.25), rgba(34,211,238,0.3))",
          animationDelay: "-9s",
          animationDuration: "22s",
        }} />
      </div>

      {/* === Custom Cursor Glow Follower (rendered OUTSIDE background layer so it stays fixed) === */}
      <div
        className="cursor-glow hidden md:block"
        style={{
          left: `${cursorPos.x}px`,
          top: `${cursorPos.y}px`,
          width: cursorPos.x > 0 ? "32px" : "0",
          height: cursorPos.x > 0 ? "32px" : "0",
        }}
      />
      <div
        className="cursor-trail hidden md:block"
        style={{
          left: `${cursorTrailPos.x}px`,
          top: `${cursorTrailPos.y}px`,
          opacity: cursorTrailPos.x > 0 ? 1 : 0,
        }}
      />

      {/* Top Header Bar (Desktop & Mobile) */}
      <header
        className={`relative z-20 w-full px-6 py-4 flex items-center justify-between border-b transition-colors backdrop-blur-md ${
          isLight ? "bg-white/90 border-slate-200 shadow-sm" : "bg-[#050b18]/80 border-slate-800/60"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 scene-3d">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 p-0.5 shadow-md flex items-center justify-center preserve-3d" style={{ transformStyle: "preserve-3d" }}>
            <div
              className={`w-full h-full rounded-[10px] flex items-center justify-center font-black text-cyan-400 font-montserrat tracking-tighter ${isLight ? "bg-slate-900" : "bg-[#070e20]"}`}
              style={{ textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}
            >
              RP
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`font-black text-lg tracking-wider ${isLight ? "text-slate-900" : "text-white"}`}>
                REMO PRO
              </span>
              <span className="text-[10px] font-mono font-bold tracking-widest text-cyan-500 px-2 py-0.5 rounded bg-cyan-50 border border-cyan-200">
                ERP SYSTEM
              </span>
            </div>
          </div>
        </div>

        {/* Top Right System Controls */}
        <div className="flex items-center gap-2.5">
          {/* Server Config Button */}
          <button
            type="button"
            onClick={() => setShowServerConfig(!showServerConfig)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border ${
              showServerConfig
                ? "bg-blue-600 text-white border-blue-400 shadow-md"
                : isLight
                ? "bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-sm"
                : "bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-slate-800"
            }`}
          >
            <Settings className={`w-3.5 h-3.5 ${showServerConfig ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{lang === "ar" ? "إعدادات السيرفر" : "Server Config"}</span>
          </button>

          {/* Theme Switcher Button (Dark / Light) */}
          <button
            type="button"
            onClick={() => {
              const nextTheme = theme === "dark" ? "light" : "dark";
              setTheme(nextTheme);
              localStorage.setItem("app_login_theme", nextTheme);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border ${
              isLight
                ? "bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-900 shadow-sm"
                : "bg-slate-900/80 hover:bg-slate-800 border-slate-800 text-slate-300"
            }`}
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {theme === "dark" ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>{lang === "ar" ? "فاتح" : "Light"}</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-indigo-600" />
                <span>{lang === "ar" ? "داكن" : "Dark"}</span>
              </>
            )}
          </button>

          {/* Language Switcher */}
          <button
            type="button"
            onClick={() => setLang(lang === "ar" ? "en" : "ar")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all ${
              isLight
                ? "bg-white hover:bg-slate-100 border-slate-200 text-slate-700 shadow-sm"
                : "bg-slate-900/80 hover:bg-slate-800 border-slate-800 text-slate-300"
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-cyan-500" />
            <span>{lang === "ar" ? "English" : "العربية"}</span>
          </button>

          {/* Local System Status Pill */}
          <div
            className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${
              isLight
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-emerald-950/60 border-emerald-800/50 text-emerald-400"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 status-bounce" />
            <span>Local System</span>
          </div>
        </div>
      </header>

      {/* Server Config Dropdown Modal */}
      {showServerConfig && (
        <div className="relative z-30 max-w-2xl mx-auto w-full px-6 pt-4">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-slate-900/95 border border-blue-500/30 rounded-2xl shadow-2xl backdrop-blur-xl"
          >
            <div className="flex items-center gap-2 mb-2 text-cyan-400">
              <Server className="w-4 h-4" />
              <span className="font-bold text-xs">
                {lang === "ar" ? "إعدادات الاتصال بسيرفر النظام المخصص" : "Custom Server Connection Setup"}
              </span>
            </div>
            <p className="text-slate-400 text-xs mb-3">
              {lang === "ar"
                ? "إذا كنت تستخدم تطبيق الهواتف الذكية أو سيرفر محلي، أدخل رابط السيرفر هنا:"
                : "Enter your local or remote ERP server URL below:"}
            </p>
            <div className="flex gap-2">
              <input
                type="url"
                dir="ltr"
                value={serverUrlInput ?? ""}
                onChange={(e) => setServerUrlInput(e.target.value)}
                placeholder="http://192.168.1.100:3000"
                className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
              />
              <button
                type="button"
                onClick={handleSaveServer}
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-lg shadow-blue-600/30"
              >
                <Check className="w-4 h-4" />
                <span>{lang === "ar" ? "حفظ وإعادة التشغيل" : "Save & Reload"}</span>
              </button>
              {localStorage.getItem('API_BASE_URL') && (
                <button
                  type="button"
                  onClick={() => {
                    setServerUrlInput("");
                    localStorage.removeItem('API_BASE_URL');
                    window.location.reload();
                  }}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-xl text-xs font-bold transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Main Container - Split View on Desktop, Full Column on Mobile */}
      <main className="relative z-10 flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 md:py-10 flex flex-col md:flex-row items-center justify-between gap-8 lg:gap-12">
        
        {/* LEFT SIDE - Desktop Futuristic ERP Branding & Live Preview (Hidden on Mobile) */}
        <div className="hidden md:flex flex-col justify-between w-1/2 lg:w-[55%] space-y-8">
          <div>
            {/* Top Brand Tagline */}
            <div
              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mb-4 border ${
                isLight
                  ? "bg-blue-50 border-blue-200 text-blue-700"
                  : "bg-blue-950/60 border-blue-800/40 text-blue-400"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-500 animate-pulse" />
              <span>{lang === "ar" ? "الجيل الجديد من أنظمة الموارد ERP" : "Next Gen Enterprise ERP"}</span>
            </div>

            <h1 className={`text-4xl lg:text-5xl font-black leading-tight mb-4 tracking-tight ${isLight ? "text-slate-900" : "text-white"}`}>
              Smart ERP for <br />
              <span className="bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Modern Businesses
              </span>
            </h1>

            <p className={`text-sm lg:text-base leading-relaxed max-w-lg font-medium ${isLight ? "text-slate-600" : "text-slate-400"}`}>
              {lang === "ar"
                ? "نظام إدارة الموارد المؤسسية المتقدم (ERP): إدارة الموظفين، الحسابات المالية، المخزون، والمبيعات بذكاء وسرعة فائقة."
                : "Manage your employees, finance, inventory, customers and more with a powerful and intelligent ERP system."}
            </p>
          </div>

          {/* Interactive Mockup Dashboard Graphic - 3D Perspective Tilt */}
          <div
            className="scene-3d relative preserve-3d"
            style={{ transformStyle: "preserve-3d" }}
          >
          <div
            className={`relative rounded-2xl border p-4 shadow-2xl overflow-hidden group transition-all duration-300 card-3d-depth glow-border-3d ${
              isLight
                ? "bg-white border-slate-200"
                : "bg-gradient-to-br from-slate-900 to-slate-950 border-slate-800/80"
            }`}
            style={{
              transform: `perspective(1000px) rotateX(${tiltX * 0.6}deg) rotateY(${tiltY * 0.6}deg) translateZ(20px)`,
              transformStyle: "preserve-3d",
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/10 via-transparent to-cyan-500/10 opacity-50 group-hover:opacity-100 transition-opacity" />
            {/* Holographic shine sweep */}
            <div className="holo-shine" />
            
            {/* Window bar */}
            <div className={`flex items-center justify-between mb-3 pb-2 border-b ${isLight ? "border-slate-200" : "border-slate-800/80"}`}>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                <span className={`text-[11px] font-mono ml-2 ${isLight ? "text-slate-400" : "text-slate-500"}`}>
                  REMO PRO - Executive Dashboard
                </span>
              </div>
              <span className="text-[10px] font-mono text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200 font-bold">
                LIVE METRICS
              </span>
            </div>

            {/* Simulated UI Cards */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className={`border p-3 rounded-xl shimmer-card ${isLight ? "bg-slate-50 border-slate-200" : "bg-slate-900/90 border-slate-800"}`}>
                <span className={`text-[11px] block mb-0.5 ${isLight ? "text-slate-500" : "text-slate-400"}`}>Total Employees</span>
                <div className="flex items-baseline justify-between">
                  <span className={`text-xl font-bold count-pulse inline-block ${isLight ? "text-slate-900" : "text-white"}`}>
                    {Number(employeesCount || 0).toLocaleString()}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">+12.5%</span>
                </div>
              </div>
              <div className={`border p-3 rounded-xl shimmer-card ${isLight ? "bg-slate-50 border-slate-200" : "bg-slate-900/90 border-slate-800"}`}>
                <span className={`text-[11px] block mb-0.5 ${isLight ? "text-slate-500" : "text-slate-400"}`}>Total Revenue</span>
                <div className="flex items-baseline justify-between">
                  <span className={`text-xl font-bold count-pulse inline-block ${isLight ? "text-slate-900" : "text-white"}`}>
                    ${Number(revenueCount || 0).toLocaleString()}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">+8.4%</span>
                </div>
              </div>
            </div>

            {/* Simulated Chart Bars */}
            <div className={`border p-3 rounded-xl flex flex-col justify-between ${isLight ? "bg-slate-50 border-slate-200" : "bg-slate-900/90 border-slate-800"}`}>
              <div className="flex justify-between items-center mb-2">
                <span className={`text-[11px] font-bold ${isLight ? "text-slate-700" : "text-slate-300"}`}>Monthly Revenue Stream</span>
                <span className={`text-[10px] ${isLight ? "text-slate-400" : "text-slate-500"}`}>Jan - Dec 2026</span>
              </div>
              <div className="flex items-end gap-1.5 h-16 pt-2">
                {[40, 65, 50, 80, 70, 90, 85, 100, 75, 95, 88, 110].map((h, idx) => (
                  <div key={idx} className={`flex-1 rounded-t overflow-hidden h-full flex items-end ${isLight ? "bg-slate-200" : "bg-slate-800"}`}>
                    <div
                      className="w-full bg-gradient-to-t from-blue-600 to-cyan-400 rounded-t transition-all duration-500"
                      style={{ height: `${h}%`, transform: `translateZ(${h / 5}px)` }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          </div>

          {/* Bottom Local Server Metadata Badge Box */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className={`p-3 border rounded-xl flex items-center gap-3 ${isLight ? "bg-white border-slate-200 shadow-sm" : "bg-slate-900/80 border-slate-800"}`}>
              <Monitor className="w-8 h-8 text-cyan-500 p-1.5 bg-cyan-50 rounded-lg border border-cyan-200" />
              <div>
                <span className={`text-xs font-bold block ${isLight ? "text-slate-900" : "text-white"}`}>Local System</span>
                <span className={`text-[10px] leading-snug block ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                  {lang === "ar" ? "النظام يعمل محلياً بأمان تام على هذا الجهاز" : "Running locally on your server"}
                </span>
              </div>
            </div>

            <div className={`p-3 border rounded-xl font-mono text-[11px] space-y-1 ${isLight ? "bg-white border-slate-200 text-slate-600 shadow-sm" : "bg-slate-900/80 border-slate-800 text-slate-400"}`}>
              <div className="flex justify-between">
                <span>Server:</span>
                <span className={`font-bold ${isLight ? "text-slate-800" : "text-slate-200"}`}>DESKTOP-7F3K2M</span>
              </div>
              <div className="flex justify-between">
                <span>Database:</span>
                <span className="text-cyan-600 font-bold">PostgreSQL</span>
              </div>
              <div className="flex justify-between">
                <span>Status:</span>
                <span className="text-emerald-600 font-bold">Connected</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT SIDE - Desktop & Mobile Login Box with 3D Depth */}
        <div className="w-full md:w-1/2 lg:w-[50%] max-w-xl mx-auto scene-3d">
          <motion.div
            initial={{ opacity: 0, y: 15, rotateX: -8 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
            className={`border rounded-[32px] p-8 sm:p-10 lg:p-12 backdrop-blur-xl relative overflow-hidden transition-all duration-300 card-3d-depth ${
              isLight
                ? "bg-white/95 border-slate-200/80 shadow-[0_25px_60px_-15px_rgba(59,130,246,0.25),0_20px_50px_rgba(0,0,0,0.08)]"
                : "bg-[#0b1429]/90 border-blue-500/20 shadow-[0_25px_80px_-15px_rgba(34,211,238,0.3),0_20px_80px_rgba(0,0,0,0.6)]"
            }`}
            style={{
              transform: `perspective(1200px) rotateX(${tiltX * 0.3}deg) rotateY(${tiltY * 0.3}deg)`,
              transformStyle: "preserve-3d",
            }}
          >
            {/* Top Accent Line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-cyan-400 to-indigo-600" />
            {/* Holographic shine sweep on login card */}
            <div className="holo-shine" />

            {/* 3D REMO PRO Logo Header */}
            <div className="flex flex-col items-center text-center mb-8 preserve-3d" style={{ transformStyle: "preserve-3d" }}>
              <div className="relative w-full flex items-center justify-center mb-3 preserve-3d" style={{ transformStyle: "preserve-3d", transform: `translateZ(40px)` }}>
                {/* Glowing ambient light behind logo */}
                <motion.div 
                  animate={{
                    scale: [1, 1.25, 1],
                    opacity: isLight ? [0.25, 0.45, 0.25] : [0.35, 0.65, 0.35]
                  }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  className={`absolute w-36 h-36 rounded-full blur-3xl pointer-events-none ${isLight ? "bg-blue-500/30" : "bg-cyan-400/35"}`}
                  style={{ transform: "translateZ(-20px)" }}
                />

                {/* Main 3D Moving REMO PRO Text Container */}
                <motion.div 
                  animate={{
                    rotateX: [12, -12, 12],
                    rotateY: [-16, 16, -16],
                    y: [-6, 6, -6],
                  }}
                  transition={{
                    duration: 6,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="relative flex items-center justify-center font-black text-5xl sm:text-6xl tracking-[0.15em] uppercase preserve-3d py-2 select-none"
                  dir="ltr"
                  style={{
                    fontFamily: "'Montserrat', 'Arial', sans-serif",
                    transformStyle: "preserve-3d",
                    color: isLight ? "#0f172a" : "#ffffff",
                    textShadow: isLight
                      ? "0 1px 0 #cbd5e1, 0 2px 0 #94a3b8, 0 3px 0 #64748b, 0 4px 0 #475569, 0 5px 0 #334155, 0 6px 0 #1e293b, 0 12px 20px rgba(15,23,42,0.25), 0 0 15px rgba(59,130,246,0.2)"
                      : "0 1px 0 #38bdf8, 0 2px 0 #0284c7, 0 3px 0 #0369a1, 0 4px 0 #075985, 0 5px 0 #0c4a6e, 0 6px 0 #082f49, 0 0 30px rgba(56,189,248,0.7), 0 15px 30px rgba(0,0,0,0.8)",
                  }}
                >
                  {"REMO PRO".split("").map((letter, idx) => (
                    <motion.span
                      key={idx}
                      animate={{
                        y: [0, -8, 0],
                        rotateZ: [0, idx % 2 === 0 ? 3 : -3, 0],
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: idx * 0.12,
                      }}
                      className="inline-block preserve-3d"
                    >
                      {letter === " " ? "\u00A0" : letter}
                    </motion.span>
                  ))}
                </motion.div>
              </div>
              <h2
                className={`text-2xl font-black text-stagger gentle-float ${lang === "ar" ? "text-stagger-arabic" : ""} ${isLight ? "text-slate-900" : "text-white"}`}
                style={{ transform: "translateZ(30px)" }}
              >
                {welcomeChunks.map((chunk, i) => (
                  <span key={i} style={{ animationDelay: `${0.4 + i * 0.12}s` }}>
                    {lang === "ar"
                      ? chunk
                      : (chunk === " " ? "\u00A0" : chunk)}
                  </span>
                ))}
              </h2>
              <p className={`text-xs font-medium mt-1 ${isLight ? "text-slate-500" : "text-slate-400"}`} style={{ transform: "translateZ(20px)" }}>
                {lang === "ar"
                  ? "سجّل الدخول للوصول إلى نظام REMO PRO ERP"
                  : "Sign in to access your REMO PRO ERP system"}
              </p>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-rose-50 text-rose-700 p-3.5 rounded-2xl mb-5 text-xs font-bold border border-rose-200 text-center shadow-sm"
              >
                {error}
              </motion.div>
            )}

            {forcePasswordChange ? (
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="text-center mb-4">
                  <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                    <KeyRound className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-amber-700">
                    {lang === "ar" ? "يجب تغيير كلمة المرور قبل المتابعة" : "Must change password before proceeding"}
                  </p>
                </div>
                <div>
                  <label className={`block text-xs font-bold mb-1.5 ${isLight ? "text-slate-700" : "text-slate-300"}`}>
                    {lang === "ar" ? "كلمة المرور الجديدة" : "New Password"}
                  </label>
                  <input
                    type="password"
                    value={newPassword ?? ""}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={`w-full px-4 py-3 border rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 font-semibold text-sm ${
                      isLight
                        ? "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
                        : "bg-slate-950/80 border-slate-800 text-white placeholder-slate-600"
                    }`}
                    placeholder="••••••••"
                    required
                    minLength={8}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-bold mb-1.5 ${isLight ? "text-slate-700" : "text-slate-300"}`}>
                    {lang === "ar" ? "تأكيد كلمة المرور" : "Confirm Password"}
                  </label>
                  <input
                    type="password"
                    value={confirmPassword ?? ""}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`w-full px-4 py-3 border rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 font-semibold text-sm ${
                      isLight
                        ? "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
                        : "bg-slate-950/80 border-slate-800 text-white placeholder-slate-600"
                    }`}
                    placeholder="••••••••"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoadingForm}
                  className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-600/30 hover:opacity-95 transition-all"
                >
                  {isLoadingForm ? "Updating..." : (lang === "ar" ? "تحديث كلمة المرور" : "Update Password")}
                </button>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Username Input */}
                <div className="input-3d-lift preserve-3d" style={{ transformStyle: "preserve-3d" }}>
                  <label className={`block text-xs font-bold mb-1.5 ${isLight ? "text-slate-700" : "text-slate-300"}`}>
                    {lang === "ar" ? "اسم المستخدم" : "Username"}
                  </label>
                  <div className="relative group">
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-cyan-500 transition-colors">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={username ?? ""}
                      onChange={(e) => setUsername(e.target.value)}
                      className={`w-full pr-10 pl-4 py-3 border rounded-xl font-medium text-sm transition-all focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 ${
                        isLight
                          ? "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white"
                          : "bg-[#070e20] border-slate-800 text-white placeholder-slate-600"
                      }`}
                      placeholder={lang === "ar" ? "أدخل اسم المستخدم" : "Enter your username"}
                      required
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div className="input-3d-lift preserve-3d" style={{ transformStyle: "preserve-3d" }}>
                  <label className={`block text-xs font-bold mb-1.5 ${isLight ? "text-slate-700" : "text-slate-300"}`}>
                    {lang === "ar" ? "كلمة المرور" : "Password"}
                  </label>
                  <div className="relative group">
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-cyan-500 transition-colors">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password ?? ""}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`w-full pr-10 pl-10 py-3 border rounded-xl font-medium text-sm transition-all focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 ${
                        isLight
                          ? "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white"
                          : "bg-[#070e20] border-slate-800 text-white placeholder-slate-600"
                      }`}
                      placeholder={lang === "ar" ? "أدخل كلمة المرور" : "Enter your password"}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember Me & Forgot Password Row */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <label className={`flex items-center gap-2 cursor-pointer select-none ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/30"
                    />
                    <span>{lang === "ar" ? "تذكرني" : "Remember Me"}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => alert(lang === "ar" ? "يرجى التواصل مع مسؤول النظام لإعادة تعيين كلمة المرور." : "Please contact system administrator to reset password.")}
                    className="text-cyan-600 hover:text-cyan-500 font-bold transition-colors"
                  >
                    {lang === "ar" ? "نسيت كلمة المرور؟" : "Forgot Password?"}
                  </button>
                </div>

                {/* Primary Sign In Button - Magnetic + Ripple */}
                <div className="pt-2 space-y-3">
                  <motion.button
                    type="submit"
                    disabled={isLoadingForm}
                    whileTap={{ scale: 0.96 }}
                    onMouseMove={handleBtnMouseMove}
                    onMouseLeave={handleBtnMouseLeave}
                    onClick={handleBtnClick}
                    className="magnetic-btn w-full bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white py-3.5 px-6 rounded-xl font-bold text-sm shadow-[0_0_25px_rgba(37,99,235,0.3)] transition-all flex items-center justify-center gap-2 group disabled:opacity-75 relative overflow-hidden"
                    style={{
                      transform: `translate(${btnOffset.x}px, ${btnOffset.y}px)`,
                      boxShadow: btnOffset.x !== 0
                        ? `0 10px 35px rgba(34,211,238,0.5), 0 0 30px rgba(59,130,246,0.4)`
                        : undefined,
                    }}
                  >
                    {/* Ripple effects */}
                    {ripples.map(r => (
                      <span
                        key={r.id}
                        className="ripple-effect"
                        style={{
                          left: r.x,
                          top: r.y,
                          width: 12,
                          height: 12,
                          marginLeft: -6,
                          marginTop: -6,
                        }}
                      />
                    ))}
                    {isLoadingForm ? (
                      <span className="inline-block animate-spin border-2 border-white border-t-transparent rounded-full w-5 h-5" />
                    ) : (
                      <>
                        <span>{lang === "ar" ? "تسجيل الدخول" : "Sign In"}</span>
                        {lang === "ar" ? (
                          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        ) : (
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        )}
                      </>
                    )}
                  </motion.button>

                  {/* Smartphone Mobile Employee App Button */}
                  {onOpenMobilePortal && (
                    <motion.button
                      type="button"
                      onClick={onOpenMobilePortal}
                      whileTap={{ scale: 0.98 }}
                      className={`w-full p-3 rounded-xl font-bold text-xs flex items-center justify-between transition-all group shadow-sm border ${
                        isLight
                          ? "bg-emerald-50 hover:bg-emerald-100/80 text-emerald-900 border-emerald-200"
                          : "bg-slate-900/90 hover:bg-slate-800/90 text-emerald-400 border-emerald-500/30"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center border ${
                            isLight
                              ? "bg-white text-emerald-600 border-emerald-200 shadow-sm"
                              : "bg-emerald-950 text-emerald-400 border-emerald-800/60"
                          }`}
                        >
                          <Smartphone className="w-4 h-4" />
                        </div>
                        <div className="text-right">
                          <div className={`font-bold text-xs ${isLight ? "text-emerald-950" : "text-emerald-300"}`}>
                            {lang === "ar" ? "تطبيق الهواتف الذكية للموظفين" : "Employee Mobile App"}
                          </div>
                          <div className={`text-[10px] ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                            {lang === "ar" ? "بصمة السيلفي، المرتبات والإجازات" : "Selfie Biometrics & Payroll"}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-700 px-2 py-0.5 rounded border border-emerald-300">
                        OPEN
                      </span>
                    </motion.button>
                  )}
                </div>
              </form>
            )}

            {/* System Status Indicators Grid */}
            <div className={`mt-6 pt-5 border-t ${isLight ? "border-slate-200" : "border-slate-800/80"}`}>
              <span className={`text-[10px] font-mono font-bold tracking-wider uppercase block text-center mb-3 ${isLight ? "text-slate-400" : "text-slate-500"}`}>
                System Status (Local)
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div className={`p-2 border rounded-lg flex items-center gap-2 ${isLight ? "bg-slate-50 border-slate-200" : "bg-slate-950/60 border-slate-800/80"}`}>
                  <Database className="w-3.5 h-3.5 text-cyan-500" />
                  <div className="text-[10px]">
                    <div className={`font-bold ${isLight ? "text-slate-800" : "text-slate-200"}`}>Database</div>
                    <div className="text-emerald-600 flex items-center gap-1 font-mono font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Connected
                    </div>
                  </div>
                </div>

                <div className={`p-2 border rounded-lg flex items-center gap-2 ${isLight ? "bg-slate-50 border-slate-200" : "bg-slate-950/60 border-slate-800/80"}`}>
                  <Cpu className="w-3.5 h-3.5 text-blue-500" />
                  <div className="text-[10px]">
                    <div className={`font-bold ${isLight ? "text-slate-800" : "text-slate-200"}`}>Server</div>
                    <div className="text-emerald-600 flex items-center gap-1 font-mono font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Running
                    </div>
                  </div>
                </div>

                <div className={`p-2 border rounded-lg flex items-center gap-2 ${isLight ? "bg-slate-50 border-slate-200" : "bg-slate-950/60 border-slate-800/80"}`}>
                  <Bot className="w-3.5 h-3.5 text-indigo-500" />
                  <div className="text-[10px]">
                    <div className={`font-bold ${isLight ? "text-slate-800" : "text-slate-200"}`}>AI Assistant</div>
                    <div className="text-emerald-600 flex items-center gap-1 font-mono font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Online
                    </div>
                  </div>
                </div>

                <div className={`p-2 border rounded-lg flex items-center gap-2 ${isLight ? "bg-slate-50 border-slate-200" : "bg-slate-950/60 border-slate-800/80"}`}>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <div className="text-[10px]">
                    <div className={`font-bold ${isLight ? "text-slate-800" : "text-slate-200"}`}>Backup</div>
                    <div className="text-emerald-600 flex items-center gap-1 font-mono font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Up to date
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className={`relative z-20 w-full px-6 py-3 border-t text-xs flex flex-col sm:flex-row justify-between items-center gap-2 transition-colors ${
        isLight
          ? "bg-white/90 border-slate-200 text-slate-500 shadow-sm"
          : "bg-[#050b18]/80 border-slate-800/60 text-slate-500"
      }`}>
        <span>© {new Date().getFullYear()} REMO PRO ERP - All rights reserved</span>
        <span className={`font-mono text-[10px] border px-2.5 py-0.5 rounded-full ${
          isLight ? "bg-slate-100 border-slate-200 text-slate-600" : "bg-slate-900 border-slate-800 text-slate-400"
        }`}>
          Version 2.0.0
        </span>
      </footer>
    </div>
  );
};

