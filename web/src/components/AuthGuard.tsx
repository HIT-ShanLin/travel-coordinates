import { type ReactNode } from "react";
import { isLoggedIn } from "../lib/auth";
import { LoginPage } from "./LoginPage";

type Props = {
  children: ReactNode;
  loggedIn: boolean;
  onLogin: () => void;
};

export function AuthGuard({ children, loggedIn, onLogin }: Props) {
  if (!loggedIn && !isLoggedIn()) {
    return <LoginPage onLogin={onLogin} />;
  }
  return <>{children}</>;
}
