import Image from 'next/image';
import { loginAction } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'E-mail ou senha incorretos.',
  missing_fields: 'Preencha e-mail e senha.',
  not_registered: 'Usuário não encontrado. Solicite acesso ao owner.',
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-md">
        <div className="mb-12 flex flex-col items-center gap-6">
          <Image
            src="/logo.png"
            alt="Studio SAL"
            width={220}
            height={72}
            className="object-contain"
            priority
          />
          <p className="text-micro text-ink-muted">
            entre com sua conta.
          </p>
        </div>

        <div className="border border-line bg-paper p-10">
          <LoginForm searchParams={searchParams} />
        </div>
      </div>
    </main>
  );
}

async function LoginForm({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const errorMessage = params.error
    ? (ERROR_MESSAGES[params.error] ?? 'Algo deu errado.')
    : null;

  return (
    <form action={loginAction} className="space-y-6">
      {errorMessage && (
        <div className="border-l-2 border-l-clay bg-canvas px-4 py-3 text-body text-ink">
          {errorMessage}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="voce@exemplo.com"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />
      </div>

      <Button type="submit" variant="solid" className="w-full">
        entrar
      </Button>
    </form>
  );
}
