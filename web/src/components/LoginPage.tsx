import { useState } from "react";
import { login, sendCode } from "../lib/api";
import { setToken, setUser } from "../lib/auth";

type Props = {
  onLogin: () => void;
};

export function LoginPage({ onLogin }: Props) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSendCode() {
    if (!/^1\d{10}$/.test(phone)) {
      setError("请输入正确的手机号");
      return;
    }
    setError(null);
    setSending(true);
    try {
      await sendCode(phone);
      let n = 60;
      setCountdown(n);
      const timer = setInterval(() => {
        n--;
        setCountdown(n);
        if (n <= 0) clearInterval(timer);
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送失败");
    } finally {
      setSending(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!phone || !code) return;
    setError(null);
    setLoading(true);
    try {
      const result = await login(phone, code);
      setToken(result.token);
      setUser(result.user);
      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <h1>🗺️ 旅行坐标</h1>
          <p>记录每一次旅行</p>
        </div>

        <form className="login-form" onSubmit={handleLogin}>
          <div className="input-group">
            <label>手机号</label>
            <input
              type="tel"
              maxLength={11}
              placeholder="请输入手机号"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label>验证码</label>
            <div className="code-row">
              <input
                type="text"
                maxLength={6}
                placeholder="请输入验证码"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <button
                type="button"
                className="send-code-btn"
                disabled={sending || countdown > 0}
                onClick={handleSendCode}
              >
                {countdown > 0 ? `${countdown}s` : sending ? "发送中..." : "发送验证码"}
              </button>
            </div>
          </div>

          {error && <div className="error">{error}</div>}

          <button className="primary-btn login-submit" type="submit" disabled={loading}>
            {loading ? "登录中..." : "登录 / 注册"}
          </button>
        </form>
      </div>
    </div>
  );
}
