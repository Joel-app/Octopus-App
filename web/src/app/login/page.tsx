import { BrandLogo } from "@/lib/theme/BrandLogo";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
      <BrandLogo size={64} />
      <h1 className="text-xl font-semibold">Admin sign in</h1>
      <LoginForm />
    </main>
  );
}
